package com.ruralhealth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ServiceRequest(
        @NotBlank(message = "Name is required") @Size(max = 100) String name,
        @Size(max = 300) String description) {
}
