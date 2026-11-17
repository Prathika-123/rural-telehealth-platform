package com.ruralhealth.dto.response;

import com.ruralhealth.entity.HealthcareService;

public record ServiceResponse(Long id, String name, String description) {
    public static ServiceResponse from(HealthcareService s) {
        return new ServiceResponse(s.getId(), s.getName(), s.getDescription());
    }
}
