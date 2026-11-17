package com.ruralhealth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    private static final String PASSWORD = "Strong123";
    private static final String ADMIN_EMAIL = "admin@test.local";
    private static final String ADMIN_PASSWORD = "AdminPass123";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    // ---------- helpers ----------
    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private ResultActions register(String email, String password, String role) throws Exception {
        return mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of(
                        "name", "Test User", "email", email, "password", password, "role", role))));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("email", email, "password", password))));
    }

    private String tokenFor(String email, String password) throws Exception {
        String body = login(email, password).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return om.readTree(body).get("token").asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    // ---------- registration ----------
    @Test
    void registerCreatesUserAndNeverExposesPassword() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.role").value("USER"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist());
    }

    @Test
    void duplicateEmailIsRejectedWithConflict() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER").andExpect(status().isCreated());
        register(email.toUpperCase(), PASSWORD, "USER")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    void weakPasswordFailsValidation() throws Exception {
        register(uniqueEmail(), "short", "USER")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void adminRoleCannotBeSelfRegistered() throws Exception {
        register(uniqueEmail(), PASSWORD, "ADMIN")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_ALLOWED"));
    }

    @Test
    void pharmacyAndProviderRolesCanRegister() throws Exception {
        register(uniqueEmail(), PASSWORD, "PHARMACY").andExpect(status().isCreated());
        register(uniqueEmail(), PASSWORD, "HEALTHCARE_PROVIDER").andExpect(status().isCreated());
    }

    // ---------- login / token ----------
    @Test
    void wrongPasswordReturnsUnauthorized() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER").andExpect(status().isCreated());
        login(email, "Wrong1234")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void validTokenAccessesProfileAndMissingTokenIsRejected() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER").andExpect(status().isCreated());
        String token = tokenFor(email, PASSWORD);

        mvc.perform(get("/api/v1/users/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        mvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        mvc.perform(get("/api/v1/users/me").header("Authorization", bearer("not.a.jwt")))
                .andExpect(status().isUnauthorized());
    }

    // ---------- profile & language ----------
    @Test
    void languageCanBeChangedAndInvalidLanguageIsRejected() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER").andExpect(status().isCreated());
        String token = tokenFor(email, PASSWORD);

        mvc.perform(put("/api/v1/users/me/language").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"language\":\"kn\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("kn"));

        mvc.perform(get("/api/v1/users/me").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.language").value("kn"));

        mvc.perform(put("/api/v1/users/me/language").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"language\":\"fr\"}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- role-based access ----------
    @Test
    void adminEndpointsAreForbiddenToNormalUsersButOpenToAdmin() throws Exception {
        String email = uniqueEmail();
        register(email, PASSWORD, "USER").andExpect(status().isCreated());
        String userToken = tokenFor(email, PASSWORD);
        String adminToken = tokenFor(ADMIN_EMAIL, ADMIN_PASSWORD);

        mvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(userToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist());

        mvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void disablingAUserBlocksTheirExistingTokenAndLogin() throws Exception {
        String email = uniqueEmail();
        String registered = register(email, PASSWORD, "USER").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long userId = om.readTree(registered).get("user").get("id").asLong();
        String userToken = tokenFor(email, PASSWORD);
        String adminToken = tokenFor(ADMIN_EMAIL, ADMIN_PASSWORD);

        mvc.perform(patch("/api/v1/admin/users/" + userId + "/enabled")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));

        mvc.perform(get("/api/v1/users/me").header("Authorization", bearer(userToken)))
                .andExpect(status().isUnauthorized());

        login(email, PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
    }

    @Test
    void adminCannotDisableOwnAccount() throws Exception {
        String adminToken = tokenFor(ADMIN_EMAIL, ADMIN_PASSWORD);
        String me = mvc.perform(get("/api/v1/users/me").header("Authorization", bearer(adminToken)))
                .andReturn().getResponse().getContentAsString();
        long adminId = om.readTree(me).get("id").asLong();

        mvc.perform(patch("/api/v1/admin/users/" + adminId + "/enabled")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_DISABLE_SELF"));
    }
}
