package com.ruralhealth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateLanguageRequest(
        @NotBlank(message = "Language is required")
        @Pattern(regexp = "en|kn|hi", message = "Language must be en, kn or hi") String language) {
}
