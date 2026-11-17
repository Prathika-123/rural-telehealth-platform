package com.ruralhealth.dto.response;

public record EmergencyResponse(String language, String reviewStatus, String disclaimer,
                                SymptomContent.Emergency emergency) {
}
