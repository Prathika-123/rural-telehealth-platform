package com.ruralhealth.util;

import java.time.DayOfWeek;
import java.time.LocalTime;

/** One weekly consulting window. Plain data, so the availability maths needs no database. */
public record Slot(DayOfWeek day, LocalTime start, LocalTime end, Long centreId, String centreName) {
}
