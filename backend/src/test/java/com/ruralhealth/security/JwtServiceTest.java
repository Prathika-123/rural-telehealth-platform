package com.ruralhealth.security;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.User;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-unit-test-secret-0123456789";

    private JwtService service(String secret, long minutes) {
        return new JwtService(new AppProperties(new AppProperties.Jwt(secret, minutes), null, null, null));
    }

    private User user() {
        User u = new User();
        u.setEmail("a@example.com");
        u.setRole(Role.USER);
        return u;
    }

    @Test
    void generatedTokenRoundTripsToEmail() {
        JwtService s = service(SECRET, 60);
        assertEquals("a@example.com", s.extractEmail(s.generateToken(user())));
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService s = service(SECRET, 60);
        String token = s.generateToken(user());
        String tampered = token.substring(0, token.length() - 2) + (token.endsWith("AA") ? "BB" : "AA");
        assertThrows(JwtException.class, () -> s.extractEmail(tampered));
    }

    @Test
    void expiredTokenIsRejected() {
        JwtService s = service(SECRET, -1);
        assertThrows(JwtException.class, () -> s.extractEmail(s.generateToken(user())));
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String token = service(SECRET, 60).generateToken(user());
        JwtService other = service("another-secret-another-secret-0123456789", 60);
        assertThrows(JwtException.class, () -> other.extractEmail(token));
    }

    @Test
    void shortSecretFailsFast() {
        assertThrows(IllegalStateException.class, () -> service("too-short", 60));
    }
}
