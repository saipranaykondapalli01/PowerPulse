package com.powerpulse.user;

/** Mirrors {@code UserSummary} in frontend/src/types/api.ts (assignee pickers). */
public record UserSummary(String id, String name, Role role, String region) {
}
