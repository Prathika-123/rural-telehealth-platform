package com.ruralhealth.config;

import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.User;
import com.ruralhealth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the first ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD, but only when no admin exists yet.
 * ADMIN accounts can never be created through the public registration API.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AppProperties props;
    private final UserRepository users;
    private final PasswordEncoder encoder;

    public AdminBootstrap(AppProperties props, UserRepository users, PasswordEncoder encoder) {
        this.props = props;
        this.users = users;
        this.encoder = encoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        AppProperties.BootstrapAdmin cfg = props.bootstrapAdmin();
        if (cfg == null || isBlank(cfg.email()) || isBlank(cfg.password())) {
            log.info("No ADMIN_EMAIL/ADMIN_PASSWORD configured; skipping admin bootstrap.");
            return;
        }
        if (users.existsByRole(Role.ADMIN)) {
            return;
        }
        if (cfg.password().length() < 8) {
            log.warn("ADMIN_PASSWORD is shorter than 8 characters; admin was NOT created.");
            return;
        }
        User admin = new User();
        admin.setName(cfg.name());
        admin.setEmail(cfg.email().trim().toLowerCase());
        admin.setPasswordHash(encoder.encode(cfg.password()));
        admin.setRole(Role.ADMIN);
        users.save(admin);
        log.info("Bootstrap admin created: {}", admin.getEmail());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
