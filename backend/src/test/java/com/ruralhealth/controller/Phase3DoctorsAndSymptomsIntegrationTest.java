package com.ruralhealth.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.closeTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The application clock is frozen at Monday 16 Nov 2026, 10:30 Asia/Kolkata so that
 * "available now" can be asserted exactly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase3DoctorsAndSymptomsIntegrationTest {

    static final Instant NOW = Instant.parse("2026-11-16T05:00:00Z");   // 10:30 IST, a Monday

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneId.of("Asia/Kolkata"));
        }
    }

    private static final String PASSWORD = "Strong123";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    // ================= helpers =================

    private static String unique() { return UUID.randomUUID().toString().replace("-", "").substring(0, 10); }

    private JsonNode json(ResultActions a) throws Exception {
        return om.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private ResultActions send(MockHttpServletRequestBuilder b, String token, Object body) throws Exception {
        if (token != null) b = b.header("Authorization", "Bearer " + token);
        if (body != null) b = b.contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body));
        return mvc.perform(b);
    }

    private String login(String email, String password) throws Exception {
        return json(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("email", email, "password", password))))).get("token").asText();
    }

    private String token(String role) throws Exception {
        String email = role.toLowerCase() + "-" + unique() + "@example.com";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("name", "T", "email", email, "password", PASSWORD, "role", role))))
                .andExpect(status().isCreated());
        return login(email, PASSWORD);
    }

    private String admin() throws Exception { return login("admin@test.local", "AdminPass123"); }

    private long centre(String providerToken, String name, double lat, double lng, boolean verified) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("type", "CLINIC");
        body.put("address", "Test Road");
        body.put("latitude", lat);
        body.put("longitude", lng);
        long id = json(send(post("/api/v1/centres"), providerToken, body).andExpect(status().isCreated())).get("id").asLong();
        if (verified) {
            send(patch("/api/v1/admin/centres/" + id + "/verify"), admin(), Map.of("status", "VERIFIED")).andExpect(status().isOk());
        }
        return id;
    }

    private long doctor(String token, String name, String specialization, long centreId) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("specialization", specialization);
        body.put("centreId", centreId);
        return json(send(post("/api/v1/doctors"), token, body).andExpect(status().isCreated())).get("id").asLong();
    }

    private Map<String, Object> slot(long centreId, String day, String start, String end) {
        return Map.of("centreId", centreId, "dayOfWeek", day, "startTime", start, "endTime", end);
    }

    private ResultActions schedule(String token, long doctorId, Map<String, Object>... slots) throws Exception {
        return send(put("/api/v1/doctors/" + doctorId + "/schedules"), token, Map.of("slots", List.of(slots)));
    }

    // ================= availability =================

    @Test
    @SuppressWarnings("unchecked")
    void availabilityIsComputedFromTheTimetableAtTheFrozenTime() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        long c = centre(provider, "C", 19.0, 76.0, true);
        long d = doctor(provider, "Dr " + unique(), "Spec" + unique(), c);

        // Monday 09:00-13:00 contains the frozen time (Monday 10:30)
        schedule(provider, d, slot(c, "MONDAY", "09:00", "13:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability.available").value(true))
                .andExpect(jsonPath("$.availability.source").value("SCHEDULE"))
                .andExpect(jsonPath("$.schedule.length()").value(1))
                .andExpect(jsonPath("$.lastUpdatedAt").exists());
        mvc.perform(get("/api/v1/doctors/" + d))   // public, no token
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability.available").value(true));

        // replace the timetable with an afternoon slot: now unavailable, next slot is 14:00 today
        schedule(provider, d, slot(c, "MONDAY", "14:00", "17:00"))
                .andExpect(jsonPath("$.availability.available").value(false))
                .andExpect(jsonPath("$.availability.nextSlot.startTime").value("14:00:00"))
                .andExpect(jsonPath("$.availability.nextSlot.date").value("2026-11-16"));

        // an empty list clears the timetable: unknown availability is shown as unavailable, never invented
        schedule(provider, d)
                .andExpect(jsonPath("$.availability.available").value(false))
                .andExpect(jsonPath("$.availability.source").value("NO_SCHEDULE"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void manualOverrideNeedsAnExpiryAndBeatsTheTimetable() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        long c = centre(provider, "C", 19.0, 76.0, true);
        long d = doctor(provider, "Dr " + unique(), "Spec" + unique(), c);
        schedule(provider, d, slot(c, "MONDAY", "09:00", "13:00")).andExpect(status().isOk());

        String inThreeHours = NOW.plus(Duration.ofHours(3)).toString();
        send(patch("/api/v1/doctors/" + d + "/availability"), provider, Map.of("status", "UNAVAILABLE", "expiresAt", inThreeHours))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability.available").value(false))
                .andExpect(jsonPath("$.availability.source").value("MANUAL_OVERRIDE"));

        // missing, past and too-far-future expiries are rejected
        send(patch("/api/v1/doctors/" + d + "/availability"), provider, Map.of("status", "UNAVAILABLE"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("AVAILABILITY_EXPIRY_INVALID"));
        send(patch("/api/v1/doctors/" + d + "/availability"), provider,
                Map.of("status", "UNAVAILABLE", "expiresAt", NOW.minus(Duration.ofHours(1)).toString()))
                .andExpect(status().isBadRequest());
        send(patch("/api/v1/doctors/" + d + "/availability"), provider,
                Map.of("status", "UNAVAILABLE", "expiresAt", NOW.plus(Duration.ofDays(8)).toString()))
                .andExpect(status().isBadRequest());

        // removing the override returns control to the timetable
        send(patch("/api/v1/doctors/" + d + "/availability"), provider, Map.of("status", "NONE"))
                .andExpect(jsonPath("$.availability.available").value(true))
                .andExpect(jsonPath("$.availability.source").value("SCHEDULE"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void scheduleValidationAndCentreOwnership() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        String other = token("HEALTHCARE_PROVIDER");
        long mine = centre(provider, "Mine", 19.0, 76.0, true);
        long theirs = centre(other, "Theirs", 19.0, 76.0, true);
        long d = doctor(provider, "Dr " + unique(), "Spec" + unique(), mine);

        schedule(provider, d, slot(mine, "MONDAY", "09:00", "13:00"), slot(mine, "MONDAY", "12:00", "15:00"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SCHEDULE_OVERLAP"));
        schedule(provider, d, slot(mine, "MONDAY", "13:00", "09:00"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SCHEDULE_INVALID"));
        // a slot at a centre this provider does not manage
        schedule(provider, d, slot(theirs, "MONDAY", "09:00", "13:00"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_CENTRE_MANAGER"));
        // back-to-back slots are fine
        schedule(provider, d, slot(mine, "MONDAY", "09:00", "13:00"), slot(mine, "MONDAY", "13:00", "15:00"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.schedule.length()").value(2));
        // a doctor cannot be created at someone else's centre
        send(post("/api/v1/doctors"), provider, Map.of("name", "X", "specialization", "Y", "centreId", theirs))
                .andExpect(status().isForbidden());
    }

    // ================= access control & visibility =================

    @Test
    void onlyTheManagingProviderCanChangeADoctorAndRolesAreEnforced() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        String other = token("HEALTHCARE_PROVIDER");
        long c = centre(provider, "C", 19.0, 76.0, true);
        long d = doctor(provider, "Dr " + unique(), "Spec" + unique(), c);
        Map<String, Object> update = Map.of("name", "Renamed", "specialization", "Spec", "centreId", c);

        send(put("/api/v1/doctors/" + d), other, update).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_DOCTOR_MANAGER"));
        send(patch("/api/v1/doctors/" + d + "/availability"), other, Map.of("status", "NONE")).andExpect(status().isForbidden());
        send(delete("/api/v1/doctors/" + d), other, null).andExpect(status().isForbidden());

        String user = token("USER");
        send(post("/api/v1/doctors"), user, update).andExpect(status().isForbidden());
        send(get("/api/v1/doctors/mine"), user, null).andExpect(status().isForbidden());
        send(post("/api/v1/doctors"), null, update).andExpect(status().isUnauthorized());

        send(put("/api/v1/doctors/" + d), provider, update).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"));
        send(delete("/api/v1/doctors/" + d), provider, null).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/doctors/" + d)).andExpect(status().isNotFound());
    }

    @Test
    void doctorsAtUnverifiedCentresAreHiddenFromThePublic() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        long pending = centre(provider, "Pending", 19.0, 76.0, false);
        String u = unique();
        long d = doctor(provider, "Dr Hidden " + u, "Spec" + u, pending);

        mvc.perform(get("/api/v1/doctors/" + d)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/doctors/search").param("name", u))
                .andExpect(jsonPath("$.totalElements").value(0));
        // the provider still sees their own doctor, including the centre's verification status
        send(get("/api/v1/doctors/mine"), provider, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].centre.verificationStatus").value("PENDING"));

        send(patch("/api/v1/admin/centres/" + pending + "/verify"), admin(), Map.of("status", "VERIFIED")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/doctors/" + d)).andExpect(status().isOk())
                .andExpect(jsonPath("$.centre.verificationStatus").doesNotExist());
    }

    // ================= search =================

    @Test
    @SuppressWarnings("unchecked")
    void searchByNameSpecializationLocationAvailabilityAndCentre() throws Exception {
        String provider = token("HEALTHCARE_PROVIDER");
        String u = unique();
        String spec = "Spec" + u;
        // isolated area (19.0, 76.0): A at the origin, B about 5 km north, C about 30 km north
        long a = centre(provider, "A" + u, 19.0, 76.0, true);
        long b = centre(provider, "B" + u, 19.045, 76.0, true);
        long c = centre(provider, "C" + u, 19.27, 76.0, true);

        long d1 = doctor(provider, "Dr Alpha " + u, spec, a);
        long d2 = doctor(provider, "Dr Beta " + u, spec, b);
        long d3 = doctor(provider, "Dr Gamma " + u, spec, c);
        long d4 = doctor(provider, "Dr Delta " + u, spec, c);   // based far away but also consults at A
        schedule(provider, d1, slot(a, "MONDAY", "09:00", "13:00")).andExpect(status().isOk());   // available at the frozen time
        schedule(provider, d2, slot(b, "MONDAY", "14:00", "17:00")).andExpect(status().isOk());   // later today
        schedule(provider, d4, slot(a, "TUESDAY", "09:00", "13:00")).andExpect(status().isOk());

        // by specialization only: everyone, alphabetical, no distances
        mvc.perform(get("/api/v1/doctors/search").param("specialization", spec.toLowerCase()))
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[0].name").value("Dr Alpha " + u))
                .andExpect(jsonPath("$.content[0].distanceKm").doesNotExist());

        // partial, case-insensitive name
        mvc.perform(get("/api/v1/doctors/search").param("name", "gAmMa " + u))
                .andExpect(jsonPath("$.totalElements").value(1));

        // near A within 10 km: Alpha (0 km) and Delta (consults at A), then Beta (5 km); Gamma is too far
        mvc.perform(get("/api/v1/doctors/search").param("specialization", spec).param("lat", "19.0")
                        .param("lng", "76.0").param("radiusKm", "10"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].name").value("Dr Alpha " + u))
                .andExpect(jsonPath("$.content[0].distanceKm").value(0.0))
                .andExpect(jsonPath("$.content[1].name").value("Dr Delta " + u))
                .andExpect(jsonPath("$.content[1].distanceKm").value(0.0))
                .andExpect(jsonPath("$.content[2].name").value("Dr Beta " + u))
                .andExpect(jsonPath("$.content[2].distanceKm").value(closeTo(5.0, 0.1)));

        // "available now" at Monday 10:30: only Alpha
        mvc.perform(get("/api/v1/doctors/search").param("specialization", spec).param("availableNow", "true"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Dr Alpha " + u));

        // one centre
        mvc.perform(get("/api/v1/doctors/search").param("specialization", spec).param("centreId", "" + b))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Dr Beta " + u));

        // bad input
        mvc.perform(get("/api/v1/doctors/search").param("lat", "19.0"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("LOCATION_REQUIRED"));
    }

    // ================= symptom information =================

    @Test
    void symptomInformationIsPublicMultilingualAndAlwaysCarriesSafetyText() throws Exception {
        mvc.perform(get("/api/v1/symptoms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("en"))
                .andExpect(jsonPath("$.disclaimer").isNotEmpty())
                .andExpect(jsonPath("$.reviewStatus").isNotEmpty())
                .andExpect(jsonPath("$.symptoms.length()").value(8));

        mvc.perform(get("/api/v1/symptoms").param("lang", "kn"))
                .andExpect(jsonPath("$.language").value("kn"))
                .andExpect(jsonPath("$.symptoms[0].name").value("ಜ್ವರ"));
        mvc.perform(get("/api/v1/symptoms").param("lang", "hi"))
                .andExpect(jsonPath("$.symptoms[0].name").value("बुखार"));
        mvc.perform(get("/api/v1/symptoms").param("lang", "fr"))   // unsupported: served in English, and says so
                .andExpect(jsonPath("$.language").value("en"));

        mvc.perform(get("/api/v1/symptoms/fever"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symptom.seeDoctorIf").isNotEmpty())
                .andExpect(jsonPath("$.symptom.emergencyIf").isNotEmpty())
                .andExpect(jsonPath("$.emergencyGuidance.numbers[0].number").value("112"));

        mvc.perform(get("/api/v1/symptoms/emergency").param("lang", "hi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emergency.signs").isNotEmpty());

        mvc.perform(get("/api/v1/symptoms/nope"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SYMPTOM_NOT_FOUND"));
    }
}
