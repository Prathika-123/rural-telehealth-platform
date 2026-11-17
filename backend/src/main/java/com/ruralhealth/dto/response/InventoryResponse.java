package com.ruralhealth.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

/** Owner's view of one inventory row, including the exact quantity. */
public record InventoryResponse(Long id, MedicineResponse medicine, int quantity, BigDecimal price,
                                boolean available, StockStatus stockStatus, Instant lastUpdatedAt, boolean stale) {
}
