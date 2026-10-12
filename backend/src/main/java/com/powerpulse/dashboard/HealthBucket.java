package com.powerpulse.dashboard;

/** Mirrors {@code HealthBucket} in frontend/src/types/api.ts. */
public record HealthBucket(String range, int min, int max, long count) {
}
