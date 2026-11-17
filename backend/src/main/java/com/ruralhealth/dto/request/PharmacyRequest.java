package com.ruralhealth.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record PharmacyRequest(
        @NotBlank(message = "Pharmacy name is required") @Size(max = 150) String name,
        @NotBlank(message = "Licence number is required") @Size(max = 60) String licenseNumber,
        @NotBlank(message = "Address is required") @Size(max = 300) String address,
        @Size(max = 100) String taluk,
        @Size(max = 100) String district,
        @Pattern(regexp = "^\\+?[0-9]{10,13}$", message = "Enter a valid phone number") String phone,
        @NotNull(message = "Latitude is required") @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @NotNull(message = "Longitude is required") @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude) {
}
