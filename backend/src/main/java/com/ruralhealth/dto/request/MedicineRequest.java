package com.ruralhealth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MedicineRequest(
        @NotBlank(message = "Brand name is required") @Size(max = 120) String brandName,
        @NotBlank(message = "Generic name is required") @Size(max = 120) String genericName,
        @NotBlank(message = "Strength is required") @Size(max = 40) String strength,
        @NotBlank(message = "Dosage form is required") @Size(max = 40) String dosageForm,
        Boolean prescriptionRequired) {
}
