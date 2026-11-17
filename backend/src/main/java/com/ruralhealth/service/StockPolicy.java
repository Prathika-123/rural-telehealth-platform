package com.ruralhealth.service;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.response.StockStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/** The two honesty rules of the platform: approximate stock only, and clearly flagged stale data. */
@Component
public class StockPolicy {

    private final AppProperties.Search cfg;

    public StockPolicy(AppProperties props) {
        this.cfg = props.searchOrDefault();
    }

    public StockStatus status(int quantity, boolean available) {
        if (!available) return StockStatus.UNAVAILABLE;
        if (quantity <= 0) return StockStatus.OUT_OF_STOCK;
        return quantity <= cfg.lowStockThreshold() ? StockStatus.LOW_STOCK : StockStatus.IN_STOCK;
    }

    /** True when the pharmacy has not touched this row for staleAfterDays or more. */
    public boolean isStale(Instant lastUpdatedAt) {
        return lastUpdatedAt == null
                || lastUpdatedAt.isBefore(Instant.now().minus(Duration.ofDays(cfg.staleAfterDays())));
    }

    public int staleAfterDays() {
        return cfg.staleAfterDays();
    }
}
