package com.ruralhealth.controller;

import com.ruralhealth.dto.request.ServiceRequest;
import com.ruralhealth.dto.request.VerifyRequest;
import com.ruralhealth.dto.response.CentreResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.PharmacyResponse;
import com.ruralhealth.dto.response.ServiceResponse;
import com.ruralhealth.entity.VerificationStatus;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.CentreService;
import com.ruralhealth.service.PharmacyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Admin review of pharmacy and centre registrations. /api/v1/admin/** is ADMIN-only in SecurityConfig. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminVerificationController {

    private final PharmacyService pharmacyService;
    private final CentreService centreService;

    public AdminVerificationController(PharmacyService pharmacyService, CentreService centreService) {
        this.pharmacyService = pharmacyService;
        this.centreService = centreService;
    }

    @GetMapping("/pharmacies")
    public PageResponse<PharmacyResponse> pharmacies(@RequestParam(required = false) VerificationStatus status,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "10") int size) {
        return pharmacyService.adminList(status, page, size);
    }

    @PatchMapping("/pharmacies/{id}/verify")
    public PharmacyResponse verifyPharmacy(@PathVariable Long id, @Valid @RequestBody VerifyRequest request,
                                           @AuthenticationPrincipal UserDetailsImpl admin) {
        return pharmacyService.setVerification(id, request.status(), admin.getUser().getId());
    }

    @GetMapping("/centres")
    public PageResponse<CentreResponse> centres(@RequestParam(required = false) VerificationStatus status,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "10") int size) {
        return centreService.adminList(status, page, size);
    }

    @PatchMapping("/centres/{id}/verify")
    public CentreResponse verifyCentre(@PathVariable Long id, @Valid @RequestBody VerifyRequest request,
                                       @AuthenticationPrincipal UserDetailsImpl admin) {
        return centreService.setVerification(id, request.status(), admin.getUser().getId());
    }

    @PostMapping("/services")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceResponse createService(@Valid @RequestBody ServiceRequest request) {
        return centreService.createService(request);
    }
}
