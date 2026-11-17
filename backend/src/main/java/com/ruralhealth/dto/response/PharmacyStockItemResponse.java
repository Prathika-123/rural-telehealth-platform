package com.ruralhealth.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

/** Public view of one in-stock item at a pharmacy: approximate status only, no exact quantity. */
public record PharmacyStockItemResponse(MedicineResponse medicine, BigDecimal price, StockStatus stockStatus,
                                        Instant lastUpdatedAt, boolean stale) {
}
