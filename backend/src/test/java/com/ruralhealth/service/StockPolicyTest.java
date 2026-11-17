package com.ruralhealth.service;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.response.StockStatus;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class StockPolicyTest {

    private final StockPolicy policy = new StockPolicy(
            new AppProperties(null, null, null, new AppProperties.Search(10, 50, 7, 10, 1000)));

    @Test
    void statusReflectsQuantityAndAvailability() {
        assertEquals(StockStatus.IN_STOCK, policy.status(11, true));
        assertEquals(StockStatus.LOW_STOCK, policy.status(10, true));
        assertEquals(StockStatus.LOW_STOCK, policy.status(1, true));
        assertEquals(StockStatus.OUT_OF_STOCK, policy.status(0, true));
        assertEquals(StockStatus.UNAVAILABLE, policy.status(500, false));
    }

    @Test
    void staleAfterConfiguredDays() {
        assertFalse(policy.isStale(Instant.now()));
        assertFalse(policy.isStale(Instant.now().minus(Duration.ofDays(6))));
        assertTrue(policy.isStale(Instant.now().minus(Duration.ofDays(8))));
        assertTrue(policy.isStale(null));
    }
}
