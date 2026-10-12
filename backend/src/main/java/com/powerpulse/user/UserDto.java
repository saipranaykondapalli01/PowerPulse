package com.powerpulse.user;

import java.time.Instant;

/** Mirrors {@code UserDto} in frontend/src/types/api.ts. Never carries the password hash. */
public record UserDto(
        String id,
        String name,
        String email,
        Role role,
        String region,
        boolean active,
        Instant createdAt,
        Instant updatedAt) {
}
