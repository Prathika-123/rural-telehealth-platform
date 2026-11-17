package com.ruralhealth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/** lastUpdatedAt is the most recent change to the doctor's details or timetable, so users can judge freshness. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DoctorResponse(Long id, String name, String specialization, String qualification, String phone,
                             Integer experienceYears, CentreSummary centre, List<ScheduleSlotResponse> schedule,
                             AvailabilityResponse availability, Double distanceKm, Instant lastUpdatedAt) {
}
