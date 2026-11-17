package com.ruralhealth.controller;

import com.ruralhealth.dto.request.CentreRequest;
import com.ruralhealth.dto.response.CentreResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.ServiceResponse;
import com.ruralhealth.entity.CentreType;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.CentreService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/centres")
public class CentreController {

    private final CentreService centreService;

    public CentreController(CentreService centreService) {
        this.centreService = centreService;
    }

    // ---- public ----

    @GetMapping("/nearby")
    public PageResponse<CentreResponse> nearby(@RequestParam(required = false) Double lat,
                                               @RequestParam(required = false) Double lng,
                                               @RequestParam(required = false) Double radiusKm,
                                               @RequestParam(required = false) CentreType type,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size) {
        return centreService.nearby(lat, lng, radiusKm, type, page, size);
    }

    @GetMapping("/services")
    public List<ServiceResponse> services() {
        return centreService.listServices();
    }

    @GetMapping("/{id}")
    public CentreResponse details(@PathVariable Long id,
                                  @RequestParam(required = false) Double lat,
                                  @RequestParam(required = false) Double lng) {
        return centreService.getPublic(id, lat, lng);
    }

    // ---- HEALTHCARE_PROVIDER role (rules in SecurityConfig) ----

    @GetMapping("/mine")
    public List<CentreResponse> mine(@AuthenticationPrincipal UserDetailsImpl principal) {
        return centreService.mine(principal.getUser().getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CentreResponse create(@AuthenticationPrincipal UserDetailsImpl principal,
                                 @Valid @RequestBody CentreRequest request) {
        return centreService.create(principal.getUser().getId(), request);
    }

    @PutMapping("/{id}")
    public CentreResponse update(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id,
                                 @Valid @RequestBody CentreRequest request) {
        return centreService.update(principal.getUser().getId(), id, request);
    }
}
