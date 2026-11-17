package com.ruralhealth.dto.response;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;

public record NextSlotResponse(LocalDate date, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime,
                               Long centreId, String centreName) {
}
