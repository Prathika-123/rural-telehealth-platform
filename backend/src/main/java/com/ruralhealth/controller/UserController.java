package com.ruralhealth.controller;

import com.ruralhealth.dto.request.UpdateLanguageRequest;
import com.ruralhealth.dto.request.UpdateProfileRequest;
import com.ruralhealth.dto.response.UserResponse;
import com.ruralhealth.security.UserDetailsImpl;
import com.ruralhealth.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public UserResponse me(@AuthenticationPrincipal UserDetailsImpl principal) {
        return userService.getById(principal.getUser().getId());
    }

    @PutMapping
    public UserResponse updateProfile(@AuthenticationPrincipal UserDetailsImpl principal,
                                      @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(principal.getUser().getId(), request);
    }

    @PutMapping("/language")
    public UserResponse updateLanguage(@AuthenticationPrincipal UserDetailsImpl principal,
                                       @Valid @RequestBody UpdateLanguageRequest request) {
        return userService.updateLanguage(principal.getUser().getId(), request.language());
    }
}
