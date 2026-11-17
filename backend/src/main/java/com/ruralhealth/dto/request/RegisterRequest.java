package com.ruralhealth.dto.request;

import com.ruralhealth.entity.Role;
import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank(message = "Name is required") @Size(max = 100) String name,
        @NotBlank(message = "Email is required") @Email(message = "Enter a valid email") @Size(max = 150) String email,
        @Pattern(regexp = "^\\+?[0-9]{10,13}$", message = "Enter a valid phone number") String phone,
        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must be 8 to 72 characters")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "Password must contain a letter and a digit")
        String password,
        @NotNull(message = "Role is required") Role role,
        @Pattern(regexp = "en|kn|hi", message = "Language must be en, kn or hi") String language) {
}
