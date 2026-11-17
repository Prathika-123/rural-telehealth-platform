package com.ruralhealth.dto.request;

import com.ruralhealth.entity.VerificationStatus;
import jakarta.validation.constraints.NotNull;

public record VerifyRequest(@NotNull(message = "Status is required") VerificationStatus status) {
}
