package com.ruralhealth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ruralhealth.entity.CentreType;
import com.ruralhealth.entity.HealthcareCentre;
import com.ruralhealth.entity.HealthcareService;
import com.ruralhealth.entity.VerificationStatus;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CentreResponse(Long id, String name, CentreType type, String address, String taluk, String district,
                             String phone, BigDecimal latitude, BigDecimal longitude, boolean emergencyAvailable,
                             List<String> services, Double distanceKm,
                             VerificationStatus verificationStatus, String managerName, String managerEmail) {

    /** Public view. distanceKm may be null when no location was supplied. */
    public static CentreResponse forPublic(HealthcareCentre c, Double distanceKm) {
        return build(c, distanceKm, false, false);
    }

    /** For the managing provider: includes the verification status. */
    public static CentreResponse forManager(HealthcareCentre c) {
        return build(c, null, true, false);
    }

    /** For admins (call inside a transaction: reads the lazy manager). */
    public static CentreResponse forAdmin(HealthcareCentre c) {
        return build(c, null, true, true);
    }

    private static CentreResponse build(HealthcareCentre c, Double distanceKm, boolean status, boolean manager) {
        List<String> services = c.getServices().stream().map(HealthcareService::getName).sorted().toList();
        return new CentreResponse(c.getId(), c.getName(), c.getType(), c.getAddress(), c.getTaluk(), c.getDistrict(),
                c.getPhone(), c.getLatitude(), c.getLongitude(), c.isEmergencyAvailable(), services, distanceKm,
                status ? c.getVerificationStatus() : null,
                manager && c.getManager() != null ? c.getManager().getName() : null,
                manager && c.getManager() != null ? c.getManager().getEmail() : null);
    }
}
