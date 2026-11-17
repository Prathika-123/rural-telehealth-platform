package com.ruralhealth.util;

import com.ruralhealth.exception.BadRequestException;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public final class ScheduleRules {

    public static final int MAX_SLOTS = 28;

    private ScheduleRules() { }

    /**
     * A slot must end after it starts (no overnight slots; split them across two days).
     * Slots on the same day must not overlap, even at different centres, because a doctor cannot be in two
     * places at once. A slot may start exactly when the previous one ends.
     */
    public static void validate(List<Slot> slots) {
        if (slots.size() > MAX_SLOTS) {
            throw new BadRequestException("SCHEDULE_INVALID", "Too many time slots.");
        }
        Map<DayOfWeek, List<Slot>> byDay = new EnumMap<>(DayOfWeek.class);
        for (Slot s : slots) {
            if (s.day() == null || s.start() == null || s.end() == null || !s.end().isAfter(s.start())) {
                throw new BadRequestException("SCHEDULE_INVALID", "Each slot must end after it starts.");
            }
            byDay.computeIfAbsent(s.day(), d -> new ArrayList<>()).add(s);
        }
        for (List<Slot> day : byDay.values()) {
            day.sort(Comparator.comparing(Slot::start));
            for (int i = 1; i < day.size(); i++) {
                if (day.get(i).start().isBefore(day.get(i - 1).end())) {
                    throw new BadRequestException("SCHEDULE_OVERLAP", "Two time slots on the same day overlap.");
                }
            }
        }
    }
}
