package com.ruralhealth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank(message = "Name is required") @Size(max = 100) String name,
        @Pattern(regexp = "^\\+?[0-9]{10,13}$", message = "Enter a valid phone number") String phone,
        @Pattern(regexp = "en|kn|hi", message = "Language must be en, kn or hi") String language) {
}
