package com.ruralhealth.dto.response;

/** One symptom plus the emergency guidance, so the page can always show "when to get urgent help". */
public record SymptomDetailResponse(String language, String reviewStatus, String disclaimer,
                                    SymptomContent.Symptom symptom, SymptomContent.Emergency emergencyGuidance) {
}
