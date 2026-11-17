package com.ruralhealth.dto.request;

import com.ruralhealth.entity.CentreType;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.Set;

public record CentreRequest(
        @NotBlank(message = "Name is required") @Size(max = 150) String name,
        @NotNull(message = "Type is required") CentreType type,
        @NotBlank(message = "Address is required") @Size(max = 300) String address,
        @Size(max = 100) String taluk,
        @Size(max = 100) String district,
        @Pattern(regexp = "^\\+?[0-9]{10,13}$", message = "Enter a valid phone number") String phone,
        @NotNull(message = "Latitude is required") @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal latitude,
        @NotNull(message = "Longitude is required") @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal longitude,
        Boolean emergencyAvailable,
        Set<Long> serviceIds) {
}
