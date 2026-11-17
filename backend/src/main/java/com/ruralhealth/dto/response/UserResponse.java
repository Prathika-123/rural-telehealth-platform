package com.ruralhealth.dto.response;

import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.User;

import java.time.Instant;

/** Safe view of a user. Never contains the password hash. */
public record UserResponse(Long id, String name, String email, String phone, Role role,
                           String language, boolean enabled, Instant createdAt) {

    public static UserResponse from(User u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(),
                u.getRole(), u.getLanguage(), u.isEnabled(), u.getCreatedAt());
    }
}
