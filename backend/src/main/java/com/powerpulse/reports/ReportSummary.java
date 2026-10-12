package com.powerpulse.reports;

import java.time.Instant;

/** Mirrors {@code ReportSummary} in frontend/src/types/api.ts. */
public record ReportSummary(
        Instant from,
        Instant to,
        long transformers,
        Double averageHealth,
        long incidents,
        long resolvedIncidents,
        Double meanTimeToResolveSeconds,
        long maintenanceCreated,
        long maintenanceCompleted,
        long highRiskTransformers) {
}
