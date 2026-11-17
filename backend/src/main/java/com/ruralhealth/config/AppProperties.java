package com.ruralhealth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/** Typed binding for the "app.*" properties. All secrets come from environment variables. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors, BootstrapAdmin bootstrapAdmin, @DefaultValue Search search) {

    public record Jwt(String secret, @DefaultValue("60") long expirationMinutes) { }

    public record Cors(@DefaultValue("http://localhost:8080") List<String> allowedOrigins) { }

    public record BootstrapAdmin(String email, String password, @DefaultValue("Platform Admin") String name) { }

    public record Search(@DefaultValue("10") double defaultRadiusKm,
                         @DefaultValue("50") double maxRadiusKm,
                         @DefaultValue("7") int staleAfterDays,
                         @DefaultValue("10") int lowStockThreshold,
                         @DefaultValue("1000") int maxCandidates) {
        public static Search defaults() {
            return new Search(10, 50, 7, 10, 1000);
        }
    }

    /** Never null, even when the object is built by hand in a unit test. */
    public Search searchOrDefault() {
        return search == null ? Search.defaults() : search;
    }
}
