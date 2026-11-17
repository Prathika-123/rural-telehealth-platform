package com.ruralhealth.service;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.request.AvailabilityRequest;
import com.ruralhealth.dto.request.DoctorRequest;
import com.ruralhealth.dto.request.ScheduleRequest;
import com.ruralhealth.dto.response.*;
import com.ruralhealth.entity.*;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.exception.ForbiddenException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.DoctorRepository;
import com.ruralhealth.repository.DoctorScheduleRepository;
import com.ruralhealth.repository.HealthcareCentreRepository;
import com.ruralhealth.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Doctor discovery and management. Availability is never stored: it is computed on every request from the
 * weekly timetable and any unexpired manual override, using the application clock (Asia/Kolkata by default).
 */
@Service
public class DoctorService {

    private static final Logger log = LoggerFactory.getLogger(DoctorService.class);
    private static final Duration MAX_OVERRIDE = Duration.ofDays(7);

    private final DoctorRepository doctors;
    private final DoctorScheduleRepository schedules;
    private final HealthcareCentreRepository centres;
    private final Clock clock;
    private final AppProperties.Search cfg;

    public DoctorService(DoctorRepository doctors, DoctorScheduleRepository schedules,
                         HealthcareCentreRepository centres, Clock clock, AppProperties props) {
        this.doctors = doctors;
        this.schedules = schedules;
        this.centres = centres;
        this.clock = clock;
        this.cfg = props.searchOrDefault();
    }

    private record Row(Doctor doctor, List<DoctorSchedule> slots, Double distanceKm, AvailabilityResponse availability) { }

    // ===================== public =====================

    @Transactional(readOnly = true)
    public DoctorResponse getPublic(Long id, Double lat, Double lng) {
        Doctor d = doctors.findById(id)
                .filter(x -> x.getPrimaryCentre().getVerificationStatus() == VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ResourceNotFoundException("DOCTOR_NOT_FOUND", "Doctor not found."));
        Double distance = null;
        List<DoctorSchedule> slots = schedules.findByDoctorId(id);
        if (lat != null || lng != null) {
            GeoUtils.validateCoordinates(lat, lng);
            distance = nearestCentreKm(d, slots, lat, lng);
        }
        return toResponse(d, slots, distance, false, ZonedDateTime.now(clock));
    }

    /**
     * Filters (name, specialization) run in SQL. Location, "available now" and distance sorting need per-doctor
     * calculation, so the SQL result is capped at maxCandidates and finished in memory.
     */
    @Transactional(readOnly = true)
    public PageResponse<DoctorResponse> search(String name, String specialization, Long centreId, Double lat,
                                               Double lng, Double radiusKm, Boolean availableNow, int page, int size) {
        String namePattern = blank(name) ? "%" : MedicineQueryParser.likePattern(name.trim());
        String specPattern = blank(specialization) ? "%" : MedicineQueryParser.likePattern(specialization.trim());
        boolean hasLocation = lat != null || lng != null;
        if (hasLocation) {
            GeoUtils.validateCoordinates(lat, lng);
        }
        PageRequest cap = PageRequest.of(0, cfg.maxCandidates());

        Collection<Long> centreIds = null;   // null = no centre restriction
        if (centreId != null) {
            centreIds = centres.findById(centreId)
                    .filter(c -> c.getVerificationStatus() == VerificationStatus.VERIFIED)
                    .map(c -> List.of(c.getId())).orElse(List.of());
        } else if (hasLocation) {
            double radius = radiusKm == null ? cfg.defaultRadiusKm() : radiusKm;
            if (!(radius > 0)) {
                throw new BadRequestException("INVALID_RADIUS", "Search radius must be greater than zero.");
            }
            final double r = Math.min(radius, cfg.maxRadiusKm());
            GeoUtils.BoundingBox box = GeoUtils.boundingBox(lat, lng, r);
            centreIds = centres.findInBox(VerificationStatus.VERIFIED, box.minLat(), box.maxLat(),
                            box.minLng(), box.maxLng(), cap).stream()
                    .filter(c -> GeoUtils.haversineKm(lat, lng, c.getLatitude().doubleValue(),
                            c.getLongitude().doubleValue()) <= r)
                    .map(HealthcareCentre::getId).toList();
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);
        if (centreIds != null && centreIds.isEmpty()) {
            return new PageResponse<>(List.of(), safePage, safeSize, 0, 0);
        }
        List<Doctor> candidates = centreIds == null
                ? doctors.searchVerified(namePattern, specPattern, VerificationStatus.VERIFIED, cap)
                : doctors.searchAtCentres(namePattern, specPattern, VerificationStatus.VERIFIED, centreIds, cap);

        Map<Long, List<DoctorSchedule>> slotsByDoctor = loadSchedules(candidates);
        ZonedDateTime now = ZonedDateTime.now(clock);
        boolean onlyAvailable = Boolean.TRUE.equals(availableNow);

        List<Row> rows = new ArrayList<>();
        for (Doctor d : candidates) {
            List<DoctorSchedule> slots = slotsByDoctor.getOrDefault(d.getId(), List.of());
            AvailabilityResponse av = availability(d, slots, now);
            if (onlyAvailable && !av.available()) continue;
            Double dist = hasLocation ? nearestCentreKm(d, slots, lat, lng) : null;
            rows.add(new Row(d, slots, dist, av));
        }
        Comparator<Row> order = hasLocation
                ? Comparator.comparing(Row::distanceKm).thenComparing(r -> r.doctor().getName(), String.CASE_INSENSITIVE_ORDER)
                : Comparator.comparing(r -> r.doctor().getName(), String.CASE_INSENSITIVE_ORDER);
        rows.sort(order);

        int from = (int) Math.min((long) safePage * safeSize, rows.size());
        int to = Math.min(from + safeSize, rows.size());
        List<DoctorResponse> content = rows.subList(from, to).stream()
                .map(r -> build(r.doctor(), r.slots(), r.distanceKm(), r.availability(), false)).toList();
        return new PageResponse<>(content, safePage, safeSize, rows.size(),
                (int) Math.ceil(rows.size() / (double) safeSize));
    }

    // ===================== healthcare provider =====================

    @Transactional(readOnly = true)
    public PageResponse<DoctorResponse> mine(Long managerId, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("name"));
        var result = doctors.findByPrimaryCentreManagerId(managerId, pr);
        Map<Long, List<DoctorSchedule>> slots = loadSchedules(result.getContent());
        ZonedDateTime now = ZonedDateTime.now(clock);
        return PageResponse.from(result, d -> toResponse(d, slots.getOrDefault(d.getId(), List.of()), null, true, now));
    }

    @Transactional
    public DoctorResponse create(Long managerId, DoctorRequest req) {
        HealthcareCentre centre = requireManagedCentre(managerId, req.centreId());
        Doctor d = new Doctor();
        apply(d, req);
        d.setPrimaryCentre(centre);
        doctors.save(d);
        log.info("Doctor created: id={} centre={}", d.getId(), centre.getId());
        return toResponse(d, List.of(), null, true, ZonedDateTime.now(clock));
    }

    @Transactional
    public DoctorResponse update(Long managerId, Long doctorId, DoctorRequest req) {
        Doctor d = requireManagedDoctor(managerId, doctorId);
        if (!d.getPrimaryCentre().getId().equals(req.centreId())) {
            d.setPrimaryCentre(requireManagedCentre(managerId, req.centreId()));
        }
        apply(d, req);
        return toResponse(d, schedules.findByDoctorId(doctorId), null, true, ZonedDateTime.now(clock));
    }

    @Transactional
    public void delete(Long managerId, Long doctorId) {
        Doctor d = requireManagedDoctor(managerId, doctorId);
        schedules.deleteByDoctorId(doctorId);
        doctors.delete(d);
        log.info("Doctor deleted: id={}", doctorId);
    }

    /** Replaces the whole weekly timetable. Every slot must be at a centre the provider manages. */
    @Transactional
    public DoctorResponse setSchedules(Long managerId, Long doctorId, ScheduleRequest req) {
        Doctor d = requireManagedDoctor(managerId, doctorId);
        Map<Long, HealthcareCentre> usable = new HashMap<>();
        for (ScheduleRequest.SlotRequest s : req.slots()) {
            usable.computeIfAbsent(s.centreId(), id -> requireManagedCentre(managerId, id));
        }
        List<Slot> asSlots = req.slots().stream()
                .map(s -> new Slot(s.dayOfWeek(), s.startTime(), s.endTime(), s.centreId(),
                        usable.get(s.centreId()).getName())).toList();
        ScheduleRules.validate(asSlots);

        schedules.deleteByDoctorId(doctorId);
        List<DoctorSchedule> saved = new ArrayList<>();
        for (ScheduleRequest.SlotRequest s : req.slots()) {
            DoctorSchedule e = new DoctorSchedule();
            e.setDoctor(d);
            e.setCentre(usable.get(s.centreId()));
            e.setDayOfWeek(s.dayOfWeek());
            e.setStartTime(s.startTime());
            e.setEndTime(s.endTime());
            saved.add(schedules.save(e));
        }
        return toResponse(d, saved, null, true, ZonedDateTime.now(clock));
    }

    /** Manual override with a mandatory expiry (at most 7 days), so it can never silently go stale. */
    @Transactional
    public DoctorResponse setAvailability(Long managerId, Long doctorId, AvailabilityRequest req) {
        Doctor d = requireManagedDoctor(managerId, doctorId);
        Instant now = clock.instant();
        if (req.status() == ManualStatus.NONE) {
            d.setManualStatus(ManualStatus.NONE);
            d.setManualStatusExpiresAt(null);
        } else {
            Instant exp = req.expiresAt();
            if (exp == null || !exp.isAfter(now) || exp.isAfter(now.plus(MAX_OVERRIDE))) {
                throw new BadRequestException("AVAILABILITY_EXPIRY_INVALID",
                        "Choose an expiry time in the future, within the next 7 days.");
            }
            d.setManualStatus(req.status());
            d.setManualStatusExpiresAt(exp);
        }
        return toResponse(d, schedules.findByDoctorId(doctorId), null, true, ZonedDateTime.now(clock));
    }

    // ===================== helpers =====================

    private Doctor requireManagedDoctor(Long managerId, Long doctorId) {
        Doctor d = doctors.findById(doctorId)
                .orElseThrow(() -> new ResourceNotFoundException("DOCTOR_NOT_FOUND", "Doctor not found."));
        HealthcareCentre c = d.getPrimaryCentre();
        if (c.getManager() == null || !c.getManager().getId().equals(managerId)) {
            throw new ForbiddenException("NOT_DOCTOR_MANAGER", "You do not manage this doctor.");
        }
        return d;
    }

    private HealthcareCentre requireManagedCentre(Long managerId, Long centreId) {
        HealthcareCentre c = centres.findById(centreId)
                .orElseThrow(() -> new ResourceNotFoundException("CENTRE_NOT_FOUND", "Healthcare centre not found."));
        if (c.getManager() == null || !c.getManager().getId().equals(managerId)) {
            throw new ForbiddenException("NOT_CENTRE_MANAGER", "You do not manage this centre.");
        }
        return c;
    }

    private void apply(Doctor d, DoctorRequest req) {
        d.setName(req.name().trim());
        d.setSpecialization(req.specialization().trim());
        d.setQualification(req.qualification());
        d.setPhone(req.phone());
        d.setExperienceYears(req.experienceYears());
    }

    private Map<Long, List<DoctorSchedule>> loadSchedules(List<Doctor> list) {
        if (list.isEmpty()) return Map.of();
        List<Long> ids = list.stream().map(Doctor::getId).toList();
        return schedules.findByDoctorIds(ids).stream()
                .collect(Collectors.groupingBy(s -> s.getDoctor().getId()));
    }

    private static List<Slot> toSlots(List<DoctorSchedule> list) {
        return list.stream().map(s -> new Slot(s.getDayOfWeek(), s.getStartTime(), s.getEndTime(),
                s.getCentre().getId(), s.getCentre().getName())).toList();
    }

    private AvailabilityResponse availability(Doctor d, List<DoctorSchedule> slots, ZonedDateTime now) {
        return DoctorAvailabilityCalculator.compute(d.getManualStatus(), d.getManualStatusExpiresAt(),
                toSlots(slots), now);
    }

    /** Distance to the closest verified centre this doctor is based at or scheduled at. */
    private Double nearestCentreKm(Doctor d, List<DoctorSchedule> slots, double lat, double lng) {
        List<HealthcareCentre> associated = new ArrayList<>();
        associated.add(d.getPrimaryCentre());
        slots.forEach(s -> associated.add(s.getCentre()));
        return associated.stream()
                .filter(c -> c.getVerificationStatus() == VerificationStatus.VERIFIED)
                .mapToDouble(c -> GeoUtils.haversineKm(lat, lng, c.getLatitude().doubleValue(), c.getLongitude().doubleValue()))
                .min().stream().mapToObj(x -> Math.round(x * 100) / 100.0).findFirst().orElse(null);
    }

    private DoctorResponse toResponse(Doctor d, List<DoctorSchedule> slots, Double distance,
                                      boolean forManager, ZonedDateTime now) {
        return build(d, slots, distance, availability(d, slots, now), forManager);
    }

    private DoctorResponse build(Doctor d, List<DoctorSchedule> slots, Double distance,
                                 AvailabilityResponse av, boolean forManager) {
        List<ScheduleSlotResponse> schedule = slots.stream()
                .sorted(Comparator.comparing(DoctorSchedule::getDayOfWeek).thenComparing(DoctorSchedule::getStartTime))
                .map(s -> new ScheduleSlotResponse(s.getCentre().getId(), s.getCentre().getName(),
                        s.getDayOfWeek(), s.getStartTime(), s.getEndTime())).toList();
        Instant updated = d.getUpdatedAt();
        for (DoctorSchedule s : slots) {
            if (s.getUpdatedAt() != null && (updated == null || s.getUpdatedAt().isAfter(updated))) {
                updated = s.getUpdatedAt();
            }
        }
        return new DoctorResponse(d.getId(), d.getName(), d.getSpecialization(), d.getQualification(), d.getPhone(),
                d.getExperienceYears(), CentreSummary.from(d.getPrimaryCentre(), forManager), schedule, av,
                distance, updated);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
