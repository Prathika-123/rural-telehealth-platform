package com.ruralhealth.util;

import com.ruralhealth.dto.response.AvailabilityResponse;
import com.ruralhealth.dto.response.NextSlotResponse;
import com.ruralhealth.entity.ManualStatus;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Decides whether a doctor is available right now. Never fabricates availability:
 *  1. an unexpired manual override from the clinic wins;
 *  2. otherwise the weekly timetable decides (start inclusive, end exclusive);
 *  3. with no timetable at all the doctor is reported as unavailable with source NO_SCHEDULE.
 */
public final class DoctorAvailabilityCalculator {

    private DoctorAvailabilityCalculator() { }

    public static AvailabilityResponse compute(ManualStatus manual, Instant manualExpiresAt,
                                               List<Slot> slots, ZonedDateTime now) {
        boolean overrideActive = manual != null && manual != ManualStatus.NONE
                && manualExpiresAt != null && now.toInstant().isBefore(manualExpiresAt);
        if (overrideActive) {
            boolean available = manual == ManualStatus.AVAILABLE;
            // if marked unavailable, the "next" slot is the first one after the override ends
            ZonedDateTime from = available ? now : manualExpiresAt.atZone(now.getZone());
            return new AvailabilityResponse(available, "MANUAL_OVERRIDE", manualExpiresAt, nextSlot(slots, from));
        }
        if (slots.isEmpty()) {
            return new AvailabilityResponse(false, "NO_SCHEDULE", null, null);
        }
        LocalTime time = now.toLocalTime();
        for (Slot s : slots) {
            if (s.day() == now.getDayOfWeek() && !time.isBefore(s.start()) && time.isBefore(s.end())) {
                return new AvailabilityResponse(true, "SCHEDULE", now.with(s.end()).toInstant(), null);
            }
        }
        return new AvailabilityResponse(false, "SCHEDULE", null, nextSlot(slots, now));
    }

    /** First slot that starts after the given moment, looking up to 7 days ahead (covers weekly repeats). */
    public static NextSlotResponse nextSlot(List<Slot> slots, ZonedDateTime from) {
        for (int offset = 0; offset <= 7; offset++) {
            final int o = offset;
            LocalDate date = from.toLocalDate().plusDays(offset);
            DayOfWeek dow = date.getDayOfWeek();
            Optional<Slot> next = slots.stream()
                    .filter(s -> s.day() == dow)
                    .filter(s -> o > 0 || s.start().isAfter(from.toLocalTime()))
                    .min(Comparator.comparing(Slot::start));
            if (next.isPresent()) {
                Slot s = next.get();
                return new NextSlotResponse(date, dow, s.start(), s.end(), s.centreId(), s.centreName());
            }
        }
        return null;
    }
}
