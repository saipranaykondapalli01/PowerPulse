package com.powerpulse.reports;

import com.powerpulse.transformer.TransformerStatus;
import java.time.Instant;

/** Mirrors {@code TransformerHealthReportRow} in frontend/src/types/api.ts. */
public record TransformerHealthReportRow(
        String transformerId,
        String code,
        String name,
        String location,
        int healthScore,
        TransformerStatus status,
        long activeAlerts,
        long incidentsInRange,
        boolean highRisk,
        Instant lastMaintenanceAt) {
}
