package com.ruralhealth.controller;

import com.ruralhealth.dto.request.AvailabilityRequest;
import com.ruralhealth.dto.request.DoctorRequest;
import com.ruralhealth.dto.request.ScheduleRequest;
import com.ruralhealth.dto.response.DoctorResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/doctors")
public class DoctorController {

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    // ---- public ----

    @GetMapping("/search")
    public PageResponse<DoctorResponse> search(@RequestParam(required = false) String name,
                                               @RequestParam(required = false) String specialization,
                                               @RequestParam(required = false) Long centreId,
                                               @RequestParam(required = false) Double lat,
                                               @RequestParam(required = false) Double lng,
                                               @RequestParam(required = false) Double radiusKm,
                                               @RequestParam(required = false) Boolean availableNow,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size) {
        return doctorService.search(name, specialization, centreId, lat, lng, radiusKm, availableNow, page, size);
    }

    @GetMapping("/{id}")
    public DoctorResponse details(@PathVariable Long id,
                                  @RequestParam(required = false) Double lat,
                                  @RequestParam(required = false) Double lng) {
        return doctorService.getPublic(id, lat, lng);
    }

    // ---- HEALTHCARE_PROVIDER role (rules in SecurityConfig); a provider only manages doctors at their own centres ----

    @GetMapping("/mine")
    public PageResponse<DoctorResponse> mine(@AuthenticationPrincipal UserDetailsImpl principal,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return doctorService.mine(principal.getUser().getId(), page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DoctorResponse create(@AuthenticationPrincipal UserDetailsImpl principal,
                                 @Valid @RequestBody DoctorRequest request) {
        return doctorService.create(principal.getUser().getId(), request);
    }

    @PutMapping("/{id}")
    public DoctorResponse update(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id,
                                 @Valid @RequestBody DoctorRequest request) {
        return doctorService.update(principal.getUser().getId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id) {
        doctorService.delete(principal.getUser().getId(), id);
    }

    @PutMapping("/{id}/schedules")
    public DoctorResponse setSchedules(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id,
                                       @Valid @RequestBody ScheduleRequest request) {
        return doctorService.setSchedules(principal.getUser().getId(), id, request);
    }

    @PatchMapping("/{id}/availability")
    public DoctorResponse setAvailability(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id,
                                          @Valid @RequestBody AvailabilityRequest request) {
        return doctorService.setAvailability(principal.getUser().getId(), id, request);
    }
}
