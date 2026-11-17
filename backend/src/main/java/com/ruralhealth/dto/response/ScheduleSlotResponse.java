package com.ruralhealth.dto.response;

import java.time.DayOfWeek;
import java.time.LocalTime;

public record ScheduleSlotResponse(Long centreId, String centreName, DayOfWeek dayOfWeek,
                                   LocalTime startTime, LocalTime endTime) {
}
