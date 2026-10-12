package com.powerpulse.reports;

import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.Priority;
import java.util.List;

/** Mirrors {@code MaintenanceReport} in frontend/src/types/api.ts. */
public record MaintenanceReport(
        List<StatusCount> byStatus,
        List<PriorityCount> byPriority,
        long completedOnTime,
        long completedLate,
        long overdueOpen,
        Double averageCompletionHours,
        List<TechnicianStats> byTechnician) {

    public record StatusCount(MaintenanceStatus status, long count) {
    }

    public record PriorityCount(Priority priority, long count) {
    }

    public record TechnicianStats(String technicianId, String technicianName, long assigned, long completed) {
    }
}
