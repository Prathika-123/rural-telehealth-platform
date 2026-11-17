package com.ruralhealth.controller;

import com.ruralhealth.dto.request.SetEnabledRequest;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.UserResponse;
import com.ruralhealth.entity.Role;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** URL-level rule in SecurityConfig restricts /api/v1/admin/** to ROLE_ADMIN. */
@RestController
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public PageResponse<UserResponse> list(@RequestParam(required = false) Role role,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "10") int size) {
        return userService.list(role, page, size);
    }

    @PatchMapping("/{id}/enabled")
    public UserResponse setEnabled(@PathVariable Long id,
                                   @Valid @RequestBody SetEnabledRequest request,
                                   @AuthenticationPrincipal UserDetailsImpl admin) {
        return userService.setEnabled(id, request.enabled(), admin.getUser().getId());
    }
}
