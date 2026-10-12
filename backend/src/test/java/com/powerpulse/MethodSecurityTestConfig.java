package com.powerpulse;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

/** Enables {@code @PreAuthorize} in web slice tests (the real SecurityConfig lives in the security module). */
@TestConfiguration
@EnableMethodSecurity
public class MethodSecurityTestConfig {
}
