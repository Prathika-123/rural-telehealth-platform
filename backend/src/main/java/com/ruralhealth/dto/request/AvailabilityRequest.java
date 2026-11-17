package com.ruralhealth.dto.request;

import com.ruralhealth.entity.ManualStatus;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/** Temporary override of the timetable. AVAILABLE/UNAVAILABLE need an expiry; NONE removes the override. */
public record AvailabilityRequest(@NotNull(message = "Status is required") ManualStatus status, Instant expiresAt) {
}
