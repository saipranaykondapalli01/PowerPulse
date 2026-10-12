package com.powerpulse.security;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code powerpulse.cors.allowed-origins}: comma-separated list of origins allowed to call the API with credentials. */
@ConfigurationProperties("powerpulse.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of()
                : allowedOrigins.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
