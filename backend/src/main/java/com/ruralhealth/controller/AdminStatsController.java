package com.ruralhealth.controller;

import com.ruralhealth.dto.response.AdminStatsResponse;
import com.ruralhealth.dto.response.InventoryActivityResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.service.AdminStatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** ADMIN-only (the /api/v1/admin/** rule in SecurityConfig). */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminStatsController {

    private final AdminStatsService stats;

    public AdminStatsController(AdminStatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return stats.stats();
    }

    @GetMapping("/inventory-activity")
    public PageResponse<InventoryActivityResponse> activity(@RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "15") int size) {
        return stats.recentActivity(page, size);
    }
}
