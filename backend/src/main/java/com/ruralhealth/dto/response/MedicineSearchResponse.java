package com.ruralhealth.dto.response;

/**
 * status is RESULTS, NO_PHARMACY_NEARBY (medicine exists, nobody close has it) or
 * MEDICINE_NOT_FOUND (no such medicine in the catalogue). The frontend translates these keys.
 */
public record MedicineSearchResponse(String status, String query, String strengthFilter, double radiusKm,
                                     int staleAfterDays, PageResponse<PharmacyAvailabilityResponse> results) {
}
