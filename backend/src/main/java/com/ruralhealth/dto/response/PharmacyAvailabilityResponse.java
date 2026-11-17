package com.ruralhealth.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

/** One row of a medicine search: a pharmacy that has the medicine, with distance and freshness. */
public record PharmacyAvailabilityResponse(Long pharmacyId, String pharmacyName, String address, String taluk,
                                           String district, String phone, BigDecimal latitude, BigDecimal longitude,
                                           double distanceKm, MedicineResponse medicine, BigDecimal price,
                                           StockStatus stockStatus, Instant lastUpdatedAt, boolean stale) {
}
