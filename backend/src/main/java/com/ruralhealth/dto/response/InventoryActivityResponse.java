package com.ruralhealth.dto.response;

import java.time.Instant;

/** One recent inventory change, as the admin sees it (exact quantity included). */
public record InventoryActivityResponse(Long inventoryId, Long pharmacyId, String pharmacyName, String medicineName,
                                        int quantity, boolean available, Instant lastUpdatedAt, boolean stale) {
}
