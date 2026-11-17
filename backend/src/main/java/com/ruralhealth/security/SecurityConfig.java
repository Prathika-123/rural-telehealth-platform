package com.ruralhealth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.response.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService,
                                           CustomUserDetailsService userDetailsService,
                                           @Qualifier("corsConfigurationSource") CorsConfigurationSource corsSource,
                                           ObjectMapper mapper) throws Exception {
        http
            // Stateless JWT API: no cookies/sessions, so CSRF protection is not applicable.
            .csrf(AbstractHttpConfigurer::disable)
            .cors(c -> c.configurationSource(corsSource))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                // Public discovery endpoints (read-only)
                .requestMatchers(HttpMethod.GET, "/api/v1/medicines/search", "/api/v1/medicines/suggest").permitAll()

                // Pharmacy owner endpoints. These must come BEFORE the public /pharmacies/{id} rule.
                .requestMatchers("/api/v1/pharmacies/register", "/api/v1/pharmacies/me",
                        "/api/v1/pharmacies/me/**").hasRole("PHARMACY")
                .requestMatchers(HttpMethod.GET, "/api/v1/pharmacies/*", "/api/v1/pharmacies/*/medicines").permitAll()

                // Healthcare provider endpoints, again before the public centre rules.
                .requestMatchers("/api/v1/centres/mine").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.POST, "/api/v1/centres").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.PUT, "/api/v1/centres/*").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.GET, "/api/v1/centres/nearby", "/api/v1/centres/services",
                        "/api/v1/centres/*").permitAll()

                // Doctors: provider endpoints first (/doctors/mine must not be read as /doctors/{id}), then public reads.
                .requestMatchers("/api/v1/doctors/mine").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.POST, "/api/v1/doctors").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.PUT, "/api/v1/doctors/*", "/api/v1/doctors/*/schedules").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.PATCH, "/api/v1/doctors/*/availability").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.DELETE, "/api/v1/doctors/*").hasRole("HEALTHCARE_PROVIDER")
                .requestMatchers(HttpMethod.GET, "/api/v1/doctors/search", "/api/v1/doctors/*").permitAll()

                // Symptom information is public and read-only.
                .requestMatchers(HttpMethod.GET, "/api/v1/symptoms", "/api/v1/symptoms/**").permitAll()

                // Anything else under /api/v1 needs a valid login.
                .requestMatchers("/api/v1/**").authenticated()
                .anyRequest().permitAll())   // static frontend files
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) ->
                        writeError(res, mapper, 401, "UNAUTHORIZED", "Please log in to continue."))
                .accessDeniedHandler((req, res, ex) ->
                        writeError(res, mapper, 403, "FORBIDDEN", "You do not have permission to do this.")))
            .addFilterBefore(new JwtAuthFilter(jwtService, userDetailsService),
                    UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.cors().allowedOrigins());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Accept-Language"));
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cfg);
        return source;
    }

    private static void writeError(HttpServletResponse res, ObjectMapper mapper, int status,
                                   String code, String message) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getOutputStream(), new ApiError(Instant.now(), status, code, message, null));
    }
}
