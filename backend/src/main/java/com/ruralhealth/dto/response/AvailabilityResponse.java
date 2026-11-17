package com.ruralhealth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * Computed on every request from real data, never stored.
 * source: MANUAL_OVERRIDE (clinic set it, with an expiry), SCHEDULE (weekly timetable),
 * NO_SCHEDULE (the clinic has not entered any timings, so availability is unknown, shown as unavailable).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AvailabilityResponse(boolean available, String source, Instant until, NextSlotResponse nextSlot) {
}
