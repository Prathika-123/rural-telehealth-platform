package com.ruralhealth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.ruralhealth.entity.CentreType;
import com.ruralhealth.entity.HealthcareCentre;
import com.ruralhealth.entity.VerificationStatus;

import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CentreSummary(Long id, String name, CentreType type, String address, String taluk, String district,
                            String phone, BigDecimal latitude, BigDecimal longitude,
                            VerificationStatus verificationStatus) {

    public static CentreSummary from(HealthcareCentre c, boolean includeStatus) {
        return new CentreSummary(c.getId(), c.getName(), c.getType(), c.getAddress(), c.getTaluk(), c.getDistrict(),
                c.getPhone(), c.getLatitude(), c.getLongitude(), includeStatus ? c.getVerificationStatus() : null);
    }
}
