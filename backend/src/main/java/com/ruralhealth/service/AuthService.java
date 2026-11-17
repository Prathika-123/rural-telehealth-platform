package com.ruralhealth.service;

import com.ruralhealth.dto.request.LoginRequest;
import com.ruralhealth.dto.request.RegisterRequest;
import com.ruralhealth.dto.response.AuthResponse;
import com.ruralhealth.dto.response.UserResponse;
import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.User;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.exception.DuplicateResourceException;
import com.ruralhealth.repository.UserRepository;
import com.ruralhealth.security.JwtService;
import com.ruralhealth.security.UserDetailsImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthenticationManager authManager;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder encoder,
                       AuthenticationManager authManager, JwtService jwtService) {
        this.users = users;
        this.encoder = encoder;
        this.authManager = authManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        // ADMIN accounts are never self-service.
        if (req.role() == Role.ADMIN) {
            throw new BadRequestException("ROLE_NOT_ALLOWED", "This role cannot be chosen during registration.");
        }
        String email = normalise(req.email());
        if (users.existsByEmail(email)) {
            throw new DuplicateResourceException("EMAIL_ALREADY_REGISTERED", "This email is already registered.");
        }
        User user = new User();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPhone(req.phone());
        user.setPasswordHash(encoder.encode(req.password()));
        user.setRole(req.role());
        user.setLanguage(req.language() == null ? "en" : req.language());
        users.save(user);
        log.info("User registered: id={} role={}", user.getId(), user.getRole());
        return toResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalise(req.email()), req.password()));
        User user = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        log.info("User logged in: id={}", user.getId());
        return toResponse(user);
    }

    private AuthResponse toResponse(User user) {
        return new AuthResponse(jwtService.generateToken(user), "Bearer",
                jwtService.expiresInSeconds(), UserResponse.from(user));
    }

    private static String normalise(String email) {
        return email.trim().toLowerCase();
    }
}
