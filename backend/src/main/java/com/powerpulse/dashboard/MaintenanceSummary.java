package com.powerpulse.dashboard;

import com.powerpulse.maintenance.MaintenanceDto;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.Priority;
import java.time.Instant;

/** Mirrors {@code MaintenanceSummary} in frontend/src/types/api.ts. */
public record MaintenanceSummary(
        String id,
        String transformerId,
        String transformerCode,
        String title,
        MaintenanceStatus status,
        Priority priority,
        Instant dueDate,
        boolean overdue,
        String assignedTechnicianName,
        Instant completedAt) {

    public static MaintenanceSummary from(MaintenanceTask t, Instant now) {
        return new MaintenanceSummary(t.getId(), t.getTransformerId(), t.getTransformerCode(), t.getTitle(),
                t.getStatus(), t.getPriority(), t.getDueDate(), MaintenanceDto.isOverdue(t, now),
                t.getAssignedTechnicianName(), t.getCompletedAt());
    }
}
