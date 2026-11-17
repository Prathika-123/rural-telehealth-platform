package com.ruralhealth.dto.response;

public record AuthResponse(String token, String tokenType, long expiresInSeconds, UserResponse user) {
}
