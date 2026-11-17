package com.ruralhealth.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end workflow tests. Each test uses its own random medicine name, so tests never
 * see each other's data even though they share one in-memory database.
 * Reference point: (12.0, 77.0). 0.045 degrees of latitude is about 5 km.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase2WorkflowIntegrationTest {

    private static final String PASSWORD = "Strong123";
    private static final double LAT = 12.0, LNG = 77.0;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired JdbcTemplate jdbc;

    // ================= helpers =================

    private static String unique() { return UUID.randomUUID().toString().replace("-", "").substring(0, 10); }

    private String bearer(String t) { return "Bearer " + t; }

    private JsonNode json(ResultActions a) throws Exception {
        return om.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private String token(String role) throws Exception {
        String email = role.toLowerCase() + "-" + unique() + "@example.com";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("name", "T", "email", email, "password", PASSWORD, "role", role))))
                .andExpect(status().isCreated());
        return login(email, PASSWORD);
    }

    private String login(String email, String password) throws Exception {
        return json(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("email", email, "password", password)))))
                .get("token").asText();
    }

    private String admin() throws Exception { return login("admin@test.local", "AdminPass123"); }

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b,
                               String token, Object body) throws Exception {
        if (token != null) b = b.header("Authorization", bearer(token));
        if (body != null) b = b.contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body));
        return mvc.perform(b);
    }

    private long createMedicine(String adminToken, String generic, String strength) throws Exception {
        Map<String, Object> body = Map.of("brandName", "Brand" + unique(), "genericName", generic,
                "strength", strength, "dosageForm", "Tablet", "prescriptionRequired", false);
        return json(send(post("/api/v1/admin/medicines"), adminToken, body).andExpect(status().isCreated())).get("id").asLong();
    }

    private Map<String, Object> pharmacyBody(String name, double lat, double lng) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("licenseNumber", "LIC-" + unique());
        m.put("address", "Test Street");
        m.put("latitude", lat);
        m.put("longitude", lng);
        return m;
    }

    /** Registers a pharmacy owner + pharmacy. Returns {token, pharmacyId}. */
    private Object[] pharmacy(String name, double lat, double lng, boolean verified) throws Exception {
        String t = token("PHARMACY");
        long id = json(send(post("/api/v1/pharmacies/register"), t, pharmacyBody(name, lat, lng))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.verificationStatus").value("PENDING")))
                .get("id").asLong();
        if (verified) {
            send(patch("/api/v1/admin/pharmacies/" + id + "/verify"), admin(), Map.of("status", "VERIFIED"))
                    .andExpect(status().isOk());
        }
        return new Object[]{t, id};
    }

    private long stock(String pharmacyToken, long medicineId, int qty, Boolean available) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("medicineId", medicineId);
        body.put("quantity", qty);
        body.put("price", 20.50);
        if (available != null) body.put("available", available);
        return json(send(post("/api/v1/pharmacies/me/inventory"), pharmacyToken, body).andExpect(status().isCreated()))
                .get("id").asLong();
    }

    private ResultActions search(String q, Double lat, Double lng, Double radius) throws Exception {
        var b = get("/api/v1/medicines/search").param("q", q);
        if (lat != null) b = b.param("lat", lat.toString());
        if (lng != null) b = b.param("lng", lng.toString());
        if (radius != null) b = b.param("radiusKm", radius.toString());
        return mvc.perform(b);   // deliberately no token: search is public
    }

    // ================= medicine search =================

    @Test
    void searchReturnsOnlyVerifiedInStockPharmaciesNearestFirst() throws Exception {
        String adminToken = admin();
        String generic = "Medx" + unique();
        long med = createMedicine(adminToken, generic, "500mg");

        Object[] near = pharmacy("Near", LAT, LNG, true);
        Object[] far = pharmacy("Far", LAT + 0.045, LNG, true);          // about 5 km
        Object[] unverified = pharmacy("Unverified", LAT + 0.01, LNG, false);
        Object[] zero = pharmacy("ZeroStock", LAT + 0.01, LNG, true);
        Object[] hidden = pharmacy("MarkedUnavailable", LAT + 0.01, LNG, true);

        stock((String) far[0], med, 50, null);       // inserted first, to prove sorting is by distance
        stock((String) near[0], med, 5, null);
        stock((String) unverified[0], med, 99, null);
        stock((String) zero[0], med, 0, null);
        stock((String) hidden[0], med, 40, false);

        search(generic, LAT, LNG, 20.0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESULTS"))
                .andExpect(jsonPath("$.results.totalElements").value(2))
                .andExpect(jsonPath("$.results.content[0].pharmacyName").value("Near"))
                .andExpect(jsonPath("$.results.content[0].distanceKm").value(0.0))
                .andExpect(jsonPath("$.results.content[0].stockStatus").value("LOW_STOCK"))
                .andExpect(jsonPath("$.results.content[0].stale").value(false))
                .andExpect(jsonPath("$.results.content[0].lastUpdatedAt").exists())
                .andExpect(jsonPath("$.results.content[0].quantity").doesNotExist())
                .andExpect(jsonPath("$.results.content[1].pharmacyName").value("Far"))
                .andExpect(jsonPath("$.results.content[1].stockStatus").value("IN_STOCK"))
                .andExpect(jsonPath("$.results.content[1].distanceKm").value(org.hamcrest.Matchers.closeTo(5.0, 0.1)));
    }

    @Test
    void radiusFilterExcludesFarPharmacies() throws Exception {
        String generic = "Medr" + unique();
        long med = createMedicine(admin(), generic, "250mg");
        stock((String) pharmacy("A", LAT, LNG, true)[0], med, 20, null);
        stock((String) pharmacy("B", LAT + 0.09, LNG, true)[0], med, 20, null);   // about 10 km

        search(generic, LAT, LNG, 5.0).andExpect(jsonPath("$.results.totalElements").value(1));
        search(generic, LAT, LNG, 15.0).andExpect(jsonPath("$.results.totalElements").value(2));
    }

    @Test
    void staleInventoryIsFlagged() throws Exception {
        String generic = "Meds" + unique();
        long med = createMedicine(admin(), generic, "100mg");
        Object[] p = pharmacy("Old", LAT, LNG, true);
        long invId = stock((String) p[0], med, 30, null);
        jdbc.update("update pharmacy_inventory set last_updated_at = ? where id = ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(10))), invId);

        search(generic, LAT, LNG, 10.0)
                .andExpect(jsonPath("$.results.content[0].stale").value(true))
                .andExpect(jsonPath("$.staleAfterDays").value(7));
    }

    @Test
    void searchDistinguishesUnknownMedicineFromNobodyNearby() throws Exception {
        String generic = "Medn" + unique();
        long med = createMedicine(admin(), generic, "10mg");
        stock((String) pharmacy("Only", LAT, LNG, true)[0], med, 20, null);

        search("Nonexistent" + unique(), LAT, LNG, 10.0)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("MEDICINE_NOT_FOUND"));
        search(generic, 30.0, 70.0, 10.0)   // medicine exists, but far from this location
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_PHARMACY_NEARBY"));
    }

    @Test
    void strengthInQueryTextIsUnderstood() throws Exception {
        String generic = "Medq" + unique();
        long med = createMedicine(admin(), generic, "500mg");
        stock((String) pharmacy("S", LAT, LNG, true)[0], med, 20, null);

        search(generic + " 500mg", LAT, LNG, 10.0).andExpect(jsonPath("$.status").value("RESULTS"));
        search(generic + " 650mg", LAT, LNG, 10.0).andExpect(jsonPath("$.status").value("MEDICINE_NOT_FOUND"));
    }

    @Test
    void searchRejectsBadInput() throws Exception {
        search("Paracetamol", null, null, null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("LOCATION_REQUIRED"));
        search("Paracetamol", 123.0, 77.0, null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_COORDINATES"));
        search("P", LAT, LNG, null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("QUERY_INVALID"));
        search("Paracetamol", LAT, LNG, -1.0)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_RADIUS"));
    }

    @Test
    void suggestIsPublicAndRefreshesAfterCatalogueChange() throws Exception {
        String generic = "Suggest" + unique();
        mvc.perform(get("/api/v1/medicines/suggest").param("q", generic))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        createMedicine(admin(), generic, "5mg");   // eviction must make the new entry visible
        mvc.perform(get("/api/v1/medicines/suggest").param("q", generic))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    // ================= inventory rules & access control =================

    @Test
    void negativeStockIsRejectedAtEveryEntryPoint() throws Exception {
        long med = createMedicine(admin(), "Medneg" + unique(), "5mg");
        Object[] p = pharmacy("Neg", LAT, LNG, true);
        send(post("/api/v1/pharmacies/me/inventory"), (String) p[0], Map.of("medicineId", med, "quantity", -1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.quantity").exists());

        long inv = stock((String) p[0], med, 5, null);
        send(put("/api/v1/pharmacies/me/inventory/" + inv), (String) p[0], Map.of("quantity", -5))
                .andExpect(status().isBadRequest());
    }

    @Test
    void inventoryCrudWorksAndPharmacyCannotTouchAnotherPharmacysRows() throws Exception {
        long med = createMedicine(admin(), "Medcrud" + unique(), "5mg");
        Object[] owner = pharmacy("Owner", LAT, LNG, true);
        Object[] other = pharmacy("Other", LAT, LNG, true);
        long inv = stock((String) owner[0], med, 10, null);

        send(post("/api/v1/pharmacies/me/inventory"), (String) owner[0], Map.of("medicineId", med, "quantity", 1))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVENTORY_ALREADY_EXISTS"));

        send(put("/api/v1/pharmacies/me/inventory/" + inv), (String) owner[0], Map.of("quantity", 3, "price", 9.99))
                .andExpect(status().isOk()).andExpect(jsonPath("$.quantity").value(3))
                .andExpect(jsonPath("$.stockStatus").value("LOW_STOCK"));

        send(patch("/api/v1/pharmacies/me/inventory/" + inv + "/unavailable"), (String) owner[0], null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.stockStatus").value("UNAVAILABLE"));

        // the other pharmacy gets 404 (not 403), so it cannot even learn the row exists
        send(put("/api/v1/pharmacies/me/inventory/" + inv), (String) other[0], Map.of("quantity", 99))
                .andExpect(status().isNotFound());
        send(delete("/api/v1/pharmacies/me/inventory/" + inv), (String) other[0], null)
                .andExpect(status().isNotFound());

        send(delete("/api/v1/pharmacies/me/inventory/" + inv), (String) owner[0], null)
                .andExpect(status().isNoContent());
    }

    @Test
    void rolesAreEnforcedOnPharmacyAndCentreEndpoints() throws Exception {
        String user = token("USER");
        String provider = token("HEALTHCARE_PROVIDER");
        send(get("/api/v1/pharmacies/me/inventory"), null, null).andExpect(status().isUnauthorized());
        send(get("/api/v1/pharmacies/me/inventory"), user, null).andExpect(status().isForbidden());
        send(post("/api/v1/pharmacies/register"), provider, pharmacyBody("X", LAT, LNG)).andExpect(status().isForbidden());
        send(post("/api/v1/admin/medicines"), user, Map.of()).andExpect(status().isForbidden());
        send(post("/api/v1/centres"), user, Map.of()).andExpect(status().isForbidden());
        send(post("/api/v1/centres"), token("PHARMACY"), Map.of()).andExpect(status().isForbidden());
    }

    // ================= pharmacy registration & verification =================

    @Test
    void oneUserOneLicenseAndUnverifiedPharmacyIsNotPublic() throws Exception {
        String t = token("PHARMACY");
        Map<String, Object> body = pharmacyBody("First", LAT, LNG);
        long id = json(send(post("/api/v1/pharmacies/register"), t, body).andExpect(status().isCreated())).get("id").asLong();

        send(post("/api/v1/pharmacies/register"), t, pharmacyBody("Second", LAT, LNG))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PHARMACY_ALREADY_REGISTERED"));
        send(post("/api/v1/pharmacies/register"), token("PHARMACY"), body)   // same licence number
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LICENSE_ALREADY_REGISTERED"));

        send(get("/api/v1/pharmacies/" + id), null, null).andExpect(status().isNotFound());   // still PENDING
        send(patch("/api/v1/admin/pharmacies/" + id + "/verify"), admin(), Map.of("status", "VERIFIED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ownerEmail").exists());
        send(get("/api/v1/pharmacies/" + id), null, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.licenseNumber").doesNotExist())
                .andExpect(jsonPath("$.ownerEmail").doesNotExist());
    }

    @Test
    void movingAPharmacySendsItBackToPending() throws Exception {
        Object[] p = pharmacy("Mover", LAT, LNG, true);
        Map<String, Object> moved = pharmacyBody("Mover", LAT + 1, LNG);
        moved.put("licenseNumber", json(send(get("/api/v1/pharmacies/me"), (String) p[0], null)).get("licenseNumber").asText());
        send(put("/api/v1/pharmacies/me"), (String) p[0], moved)
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("PENDING"));
    }

    // ================= medicine catalogue =================

    @Test
    void catalogueRejectsDuplicatesAndProtectsStockedMedicines() throws Exception {
        String adminToken = admin();
        Map<String, Object> body = Map.of("brandName", "Dup" + unique(), "genericName", "G" + unique(),
                "strength", "5mg", "dosageForm", "Tablet");
        long id = json(send(post("/api/v1/admin/medicines"), adminToken, body).andExpect(status().isCreated())).get("id").asLong();
        send(post("/api/v1/admin/medicines"), adminToken, body)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDICINE_ALREADY_EXISTS"));

        stock((String) pharmacy("Holder", LAT, LNG, false)[0], id, 5, null);
        send(delete("/api/v1/admin/medicines/" + id), adminToken, null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDICINE_IN_USE"));
    }

    // ================= healthcare centres =================

    private Map<String, Object> centreBody(String name, String type, double lat, double lng) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("type", type);
        m.put("address", "Test Road");
        m.put("latitude", lat);
        m.put("longitude", lng);
        m.put("emergencyAvailable", true);
        return m;
    }

    @Test
    void centreVerificationTypeFilterDistanceAndOwnership() throws Exception {
        // an isolated reference point so other tests' centres cannot interfere
        double lat = 25.0, lng = 80.0;
        String provider = token("HEALTHCARE_PROVIDER");
        String otherProvider = token("HEALTHCARE_PROVIDER");

        long svc = json(send(post("/api/v1/admin/services"), admin(), Map.of("name", "Svc" + unique()))
                .andExpect(status().isCreated())).get("id").asLong();
        Map<String, Object> hospital = centreBody("Hosp", "HOSPITAL", lat, lng);
        hospital.put("serviceIds", java.util.List.of(svc));
        long hospId = json(send(post("/api/v1/centres"), provider, hospital).andExpect(status().isCreated())
                .andExpect(jsonPath("$.verificationStatus").value("PENDING"))).get("id").asLong();
        long clinicId = json(send(post("/api/v1/centres"), provider, centreBody("Clinic", "CLINIC", lat + 0.045, lng))
                .andExpect(status().isCreated())).get("id").asLong();

        // pending centres are invisible to the public
        mvc.perform(get("/api/v1/centres/nearby").param("lat", "" + lat).param("lng", "" + lng))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        send(patch("/api/v1/admin/centres/" + hospId + "/verify"), admin(), Map.of("status", "VERIFIED")).andExpect(status().isOk());
        send(patch("/api/v1/admin/centres/" + clinicId + "/verify"), admin(), Map.of("status", "VERIFIED")).andExpect(status().isOk());

        mvc.perform(get("/api/v1/centres/nearby").param("lat", "" + lat).param("lng", "" + lng).param("radiusKm", "20"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].name").value("Hosp"))
                .andExpect(jsonPath("$.content[0].distanceKm").value(0.0))
                .andExpect(jsonPath("$.content[0].services.length()").value(1))
                .andExpect(jsonPath("$.content[0].verificationStatus").doesNotExist())
                .andExpect(jsonPath("$.content[1].name").value("Clinic"));

        mvc.perform(get("/api/v1/centres/nearby").param("lat", "" + lat).param("lng", "" + lng)
                        .param("radiusKm", "20").param("type", "CLINIC"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Clinic"));

        mvc.perform(get("/api/v1/centres/nearby")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LOCATION_REQUIRED"));

        // only the managing provider may edit
        send(put("/api/v1/centres/" + hospId), otherProvider, centreBody("Hijack", "HOSPITAL", lat, lng))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_CENTRE_MANAGER"));
        send(put("/api/v1/centres/" + hospId), provider, centreBody("Hosp Renamed", "HOSPITAL", lat, lng))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("VERIFIED"));
        // changing location or type triggers re-verification
        send(put("/api/v1/centres/" + hospId), provider, centreBody("Hosp Renamed", "CHC", lat, lng))
                .andExpect(status().isOk()).andExpect(jsonPath("$.verificationStatus").value("PENDING"));
    }
}
