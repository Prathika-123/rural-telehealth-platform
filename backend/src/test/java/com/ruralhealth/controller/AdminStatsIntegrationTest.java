package com.ruralhealth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminStatsIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("email", email, "password", password))))
                .andReturn().getResponse().getContentAsString();
        return om.readTree(body).get("token").asText();
    }

    @Test
    void adminSeesStatisticsAndActivityButOtherRolesDoNot() throws Exception {
        String email = "stats-" + UUID.randomUUID() + "@example.com";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("name", "U", "email", email, "password", "Strong123", "role", "USER"))))
                .andExpect(status().isCreated());
        String user = login(email, "Strong123");
        String admin = login("admin@test.local", "AdminPass123");

        mvc.perform(get("/api/v1/admin/stats").header("Authorization", "Bearer " + user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/stats")).andExpect(status().isUnauthorized());

        mvc.perform(get("/api/v1/admin/stats").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").isNumber())
                .andExpect(jsonPath("$.usersByRole.ADMIN").isNumber())
                .andExpect(jsonPath("$.pharmaciesByStatus.PENDING").isNumber())
                .andExpect(jsonPath("$.centresByStatus.VERIFIED").isNumber())
                .andExpect(jsonPath("$.staleAfterDays").value(7));

        mvc.perform(get("/api/v1/admin/inventory-activity").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }
}
