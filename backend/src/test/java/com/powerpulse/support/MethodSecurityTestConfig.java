package com.powerpulse.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/**
 * Enables {@code @PreAuthorize} in {@code @WebMvcTest} slices (the application's SecurityConfig is not part of
 * this module's slice).
 */
@TestConfiguration
@EnableMethodSecurity
public class MethodSecurityTestConfig {
}
