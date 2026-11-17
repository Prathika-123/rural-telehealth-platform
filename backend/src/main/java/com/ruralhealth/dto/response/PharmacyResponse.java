package com.ruralhealth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ruralhealth.entity.Pharmacy;
import com.ruralhealth.entity.VerificationStatus;

import java.math.BigDecimal;
import java.time.Instant;

/** One shape, three audiences. Null fields are omitted, so the public view never carries private data. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PharmacyResponse(Long id, String name, String address, String taluk, String district, String phone,
                               BigDecimal latitude, BigDecimal longitude,
                               String licenseNumber, VerificationStatus verificationStatus, Instant createdAt,
                               String ownerName, String ownerEmail) {

    public static PharmacyResponse forPublic(Pharmacy p) {
        return new PharmacyResponse(p.getId(), p.getName(), p.getAddress(), p.getTaluk(), p.getDistrict(),
                p.getPhone(), p.getLatitude(), p.getLongitude(), null, null, null, null, null);
    }

    public static PharmacyResponse forOwner(Pharmacy p) {
        return new PharmacyResponse(p.getId(), p.getName(), p.getAddress(), p.getTaluk(), p.getDistrict(),
                p.getPhone(), p.getLatitude(), p.getLongitude(), p.getLicenseNumber(),
                p.getVerificationStatus(), p.getCreatedAt(), null, null);
    }

    /** Call inside a transaction: reads the lazy owner. */
    public static PharmacyResponse forAdmin(Pharmacy p) {
        return new PharmacyResponse(p.getId(), p.getName(), p.getAddress(), p.getTaluk(), p.getDistrict(),
                p.getPhone(), p.getLatitude(), p.getLongitude(), p.getLicenseNumber(),
                p.getVerificationStatus(), p.getCreatedAt(), p.getOwner().getName(), p.getOwner().getEmail());
    }
}
