package com.ruralhealth.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record InventoryRequest(
        @NotNull(message = "Medicine is required") Long medicineId,
        @NotNull(message = "Quantity is required") @Min(value = 0, message = "Quantity cannot be negative") @Max(1000000) Integer quantity,
        @DecimalMin(value = "0.00", message = "Price cannot be negative") @Digits(integer = 8, fraction = 2) BigDecimal price,
        Boolean available) {
}
