package com.powerpulse.security;

import java.nio.charset.StandardCharsets;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code powerpulse.security.*}. Binding fails (and the application refuses to start) when the JWT
 * secret is blank or shorter than 32 bytes. The secret value itself is never included in messages.
 */
@ConfigurationProperties("powerpulse.security")
public record PowerPulseSecurityProperties(Jwt jwt, @DefaultValue("true") boolean cookieSecure) {

    public static final int MIN_SECRET_BYTES = 32;

    public PowerPulseSecurityProperties {
        if (jwt == null) {
            throw new IllegalStateException(
                    "powerpulse.security.jwt.secret must be configured (POWERPULSE_JWT_SECRET, at least 32 bytes)");
        }
    }

    public record Jwt(String secret, @DefaultValue("480") long expiryMinutes) {

        public Jwt {
            if (secret == null || secret.isBlank()) {
                throw new IllegalStateException(
                        "powerpulse.security.jwt.secret must be configured (POWERPULSE_JWT_SECRET, at least 32 bytes)");
            }
            if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
                throw new IllegalStateException(
                        "powerpulse.security.jwt.secret is too short: at least " + MIN_SECRET_BYTES + " bytes required");
            }
            if (expiryMinutes <= 0) {
                throw new IllegalStateException("powerpulse.security.jwt.expiry-minutes must be positive");
            }
        }

        @Override
        public String toString() {
            return "Jwt[secret=****, expiryMinutes=" + expiryMinutes + "]";
        }
    }
}
