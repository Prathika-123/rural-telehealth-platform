package com.ruralhealth.controller;

import com.ruralhealth.dto.request.PharmacyRequest;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.PharmacyResponse;
import com.ruralhealth.dto.response.PharmacyStockItemResponse;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.PharmacyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pharmacies")
public class PharmacyController {

    private final PharmacyService pharmacyService;

    public PharmacyController(PharmacyService pharmacyService) {
        this.pharmacyService = pharmacyService;
    }

    // ---- PHARMACY role (rules in SecurityConfig) ----

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public PharmacyResponse register(@AuthenticationPrincipal UserDetailsImpl principal,
                                     @Valid @RequestBody PharmacyRequest request) {
        return pharmacyService.register(principal.getUser().getId(), request);
    }

    @GetMapping("/me")
    public PharmacyResponse mine(@AuthenticationPrincipal UserDetailsImpl principal) {
        return pharmacyService.getMine(principal.getUser().getId());
    }

    @PutMapping("/me")
    public PharmacyResponse updateMine(@AuthenticationPrincipal UserDetailsImpl principal,
                                       @Valid @RequestBody PharmacyRequest request) {
        return pharmacyService.updateMine(principal.getUser().getId(), request);
    }

    // ---- public ----

    @GetMapping("/{id}")
    public PharmacyResponse details(@PathVariable Long id) {
        return pharmacyService.getPublic(id);
    }

    @GetMapping("/{id}/medicines")
    public PageResponse<PharmacyStockItemResponse> stock(@PathVariable Long id,
                                                         @RequestParam(defaultValue = "0") int page,
                                                         @RequestParam(defaultValue = "20") int size) {
        return pharmacyService.listStock(id, page, size);
    }
}
