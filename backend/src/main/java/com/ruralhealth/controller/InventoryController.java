package com.ruralhealth.controller;

import com.ruralhealth.dto.request.InventoryRequest;
import com.ruralhealth.dto.request.InventoryUpdateRequest;
import com.ruralhealth.dto.response.InventoryResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.InventoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Always operates on the caller's own pharmacy; there is no pharmacy id in these URLs by design. */
@RestController
@RequestMapping("/api/v1/pharmacies/me/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public PageResponse<InventoryResponse> list(@AuthenticationPrincipal UserDetailsImpl principal,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int size) {
        return inventoryService.list(principal.getUser().getId(), page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryResponse add(@AuthenticationPrincipal UserDetailsImpl principal,
                                 @Valid @RequestBody InventoryRequest request) {
        return inventoryService.add(principal.getUser().getId(), request);
    }

    @PutMapping("/{id}")
    public InventoryResponse update(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id,
                                    @Valid @RequestBody InventoryUpdateRequest request) {
        return inventoryService.update(principal.getUser().getId(), id, request);
    }

    @PatchMapping("/{id}/unavailable")
    public InventoryResponse markUnavailable(@AuthenticationPrincipal UserDetailsImpl principal,
                                             @PathVariable Long id) {
        return inventoryService.markUnavailable(principal.getUser().getId(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserDetailsImpl principal, @PathVariable Long id) {
        inventoryService.delete(principal.getUser().getId(), id);
    }
}
