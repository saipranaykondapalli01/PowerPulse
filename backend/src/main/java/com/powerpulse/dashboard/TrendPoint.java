package com.powerpulse.dashboard;

import java.time.Instant;

/** Mirrors {@code TrendPoint} in frontend/src/types/api.ts. */
public record TrendPoint(
        Instant bucket,
        Double avgTemperatureC,
        Double maxTemperatureC,
        Double avgLoadPct,
        Double maxLoadPct,
        long readings) {
}
