package com.ruralhealth.util;

import com.ruralhealth.dto.response.AvailabilityResponse;
import com.ruralhealth.entity.ManualStatus;
import com.ruralhealth.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DoctorAvailabilityCalculatorTest {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    /** 16 Nov 2026 is a Monday. */
    private static ZonedDateTime at(int day, int hour, int minute) {
        return ZonedDateTime.of(2026, 11, day, hour, minute, 0, 0, IST);
    }

    private static Slot slot(DayOfWeek d, String start, String end) {
        return new Slot(d, LocalTime.parse(start), LocalTime.parse(end), 1L, "Hospital");
    }

    private final List<Slot> timetable = List.of(
            slot(DayOfWeek.MONDAY, "09:00", "13:00"),
            slot(DayOfWeek.MONDAY, "14:00", "17:00"),
            slot(DayOfWeek.WEDNESDAY, "10:00", "12:00"));

    private AvailabilityResponse compute(ManualStatus m, Instant exp, List<Slot> s, ZonedDateTime now) {
        return DoctorAvailabilityCalculator.compute(m, exp, s, now);
    }

    @Test
    void availableInsideASlotWithStartInclusiveAndEndExclusive() {
        AvailabilityResponse r = compute(ManualStatus.NONE, null, timetable, at(16, 10, 30));
        assertTrue(r.available());
        assertEquals("SCHEDULE", r.source());
        assertEquals(at(16, 13, 0).toInstant(), r.until());
        assertTrue(compute(ManualStatus.NONE, null, timetable, at(16, 9, 0)).available());
        assertFalse(compute(ManualStatus.NONE, null, timetable, at(16, 13, 0)).available());
    }

    @Test
    void duringLunchBreakNextSlotIsLaterTheSameDay() {
        AvailabilityResponse r = compute(ManualStatus.NONE, null, timetable, at(16, 13, 30));
        assertFalse(r.available());
        assertEquals(LocalTime.of(14, 0), r.nextSlot().startTime());
        assertEquals(LocalDate.of(2026, 11, 16), r.nextSlot().date());
    }

    @Test
    void nextSlotMovesToAnotherDayAndWrapsToNextWeek() {
        AvailabilityResponse mondayEvening = compute(ManualStatus.NONE, null, timetable, at(16, 18, 0));
        assertEquals(DayOfWeek.WEDNESDAY, mondayEvening.nextSlot().dayOfWeek());
        assertEquals(LocalDate.of(2026, 11, 18), mondayEvening.nextSlot().date());

        AvailabilityResponse afterLastSlot = compute(ManualStatus.NONE, null, timetable, at(18, 12, 0));
        assertEquals(DayOfWeek.MONDAY, afterLastSlot.nextSlot().dayOfWeek());
        assertEquals(LocalDate.of(2026, 11, 23), afterLastSlot.nextSlot().date());
    }

    @Test
    void noTimetableMeansUnavailableNeverAvailable() {
        AvailabilityResponse r = compute(ManualStatus.NONE, null, List.of(), at(16, 10, 0));
        assertFalse(r.available());
        assertEquals("NO_SCHEDULE", r.source());
        assertNull(r.nextSlot());
    }

    @Test
    void manualUnavailableBeatsScheduleAndNextSlotStartsAfterItEnds() {
        Instant expires = at(17, 10, 0).toInstant();   // Tuesday 10:00
        AvailabilityResponse r = compute(ManualStatus.UNAVAILABLE, expires, timetable, at(16, 10, 30));
        assertFalse(r.available());
        assertEquals("MANUAL_OVERRIDE", r.source());
        assertEquals(expires, r.until());
        assertEquals(DayOfWeek.WEDNESDAY, r.nextSlot().dayOfWeek());
    }

    @Test
    void expiredOrExpiryLessOverridesAreIgnored() {
        AvailabilityResponse expired = compute(ManualStatus.UNAVAILABLE, at(16, 10, 0).toInstant(), timetable, at(16, 10, 30));
        assertTrue(expired.available());
        assertEquals("SCHEDULE", expired.source());

        AvailabilityResponse noExpiry = compute(ManualStatus.AVAILABLE, null, timetable, at(16, 19, 0));
        assertFalse(noExpiry.available());
        assertEquals("SCHEDULE", noExpiry.source());
    }

    @Test
    void manualAvailableOutsideTimetableIsFlaggedAsOverride() {
        AvailabilityResponse r = compute(ManualStatus.AVAILABLE, at(16, 22, 0).toInstant(), timetable, at(16, 19, 0));
        assertTrue(r.available());
        assertEquals("MANUAL_OVERRIDE", r.source());
    }

    @Test
    void scheduleRulesAcceptBackToBackAndRejectOverlapsAndBadTimes() {
        assertDoesNotThrow(() -> ScheduleRules.validate(List.of(
                slot(DayOfWeek.MONDAY, "09:00", "13:00"), slot(DayOfWeek.MONDAY, "13:00", "15:00"))));

        assertEquals("SCHEDULE_OVERLAP", assertThrows(BadRequestException.class, () -> ScheduleRules.validate(List.of(
                slot(DayOfWeek.MONDAY, "09:00", "13:00"), slot(DayOfWeek.MONDAY, "12:59", "15:00")))).getCode());
        assertEquals("SCHEDULE_INVALID", assertThrows(BadRequestException.class, () -> ScheduleRules.validate(List.of(
                slot(DayOfWeek.MONDAY, "13:00", "09:00")))).getCode());
        assertEquals("SCHEDULE_INVALID", assertThrows(BadRequestException.class, () -> ScheduleRules.validate(List.of(
                slot(DayOfWeek.MONDAY, "09:00", "09:00")))).getCode());
        // a doctor cannot be at two centres at once
        assertEquals("SCHEDULE_OVERLAP", assertThrows(BadRequestException.class, () -> ScheduleRules.validate(List.of(
                new Slot(DayOfWeek.TUESDAY, LocalTime.of(9, 0), LocalTime.of(12, 0), 1L, "A"),
                new Slot(DayOfWeek.TUESDAY, LocalTime.of(11, 0), LocalTime.of(14, 0), 2L, "B")))).getCode());
    }
}
