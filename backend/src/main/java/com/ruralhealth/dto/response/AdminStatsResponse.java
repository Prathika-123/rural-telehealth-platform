package com.ruralhealth.dto.response;

import java.util.Map;

public record AdminStatsResponse(long totalUsers, Map<String, Long> usersByRole,
                                 Map<String, Long> pharmaciesByStatus, Map<String, Long> centresByStatus,
                                 long doctors, long medicines, long inventoryItems,
                                 long staleInventoryItems, int staleAfterDays) {
}
