package com.ruralhealth.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

/** Replaces the doctor's whole weekly timetable. An empty list clears it. */
public record ScheduleRequest(@NotNull @Size(max = 28) List<@Valid SlotRequest> slots) {

    public record SlotRequest(@NotNull(message = "Centre is required") Long centreId,
                              @NotNull(message = "Day is required") DayOfWeek dayOfWeek,
                              @NotNull(message = "Start time is required") LocalTime startTime,
                              @NotNull(message = "End time is required") LocalTime endTime) { }
}
