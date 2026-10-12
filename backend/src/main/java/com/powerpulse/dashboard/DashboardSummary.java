package com.powerpulse.dashboard;

import java.time.Instant;
import java.util.List;

/** Mirrors {@code DashboardSummary} in frontend/src/types/api.ts. */
public record DashboardSummary(
        long totalTransformers,
        long healthy,
        long warning,
        long critical,
        long offline,
        Integer networkHealth,
        double totalLoadKva,
        double totalCapacityKva,
        long activeAlerts,
        long activeCriticalAlerts,
        long pendingMaintenance,
        long overdueMaintenance,
        List<IncidentSummary> recentIncidents,
        List<MaintenanceSummary> recentMaintenance,
        Instant generatedAt) {
}
