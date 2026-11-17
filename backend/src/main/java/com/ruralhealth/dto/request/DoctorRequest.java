package com.ruralhealth.dto.request;

import jakarta.validation.constraints.*;

public record DoctorRequest(
        @NotBlank(message = "Name is required") @Size(max = 120) String name,
        @NotBlank(message = "Specialization is required") @Size(max = 100) String specialization,
        @Size(max = 150) String qualification,
        @Pattern(regexp = "^\\+?[0-9]{10,13}$", message = "Enter a valid phone number") String phone,
        @Min(0) @Max(70) Integer experienceYears,
        @NotNull(message = "Healthcare centre is required") Long centreId) {
}
