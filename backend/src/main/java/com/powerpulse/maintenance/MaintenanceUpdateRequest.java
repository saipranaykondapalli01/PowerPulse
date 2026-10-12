package com.powerpulse.maintenance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Mirrors {@code MaintenanceUpdateRequest} in frontend/src/types/api.ts. All fields are optional (null = unchanged).
 * Field-level authorization is enforced in {@link MaintenanceService}.
 */
public record MaintenanceUpdateRequest(
        @Size(max = 200) String title,
        @Size(max = 4000) String description,
        Priority priority,
        Instant dueDate,
        String assignedTechnicianId,
        MaintenanceStatus status,
        @Size(max = 4000) String inspectionFindings,
        @Size(max = 4000) String addWorkNote,
        @Valid PartInput addPart,
        @Size(max = 1000) String cancelReason) {

    /** {@code addPart} body: {@code {name, quantity, notes?}}. */
    public record PartInput(@NotBlank @Size(max = 200) String name,
                            @Min(1) @Max(10000) int quantity,
                            @Size(max = 1000) String notes) {
    }

    boolean touchesManagerFields() {
        return title != null || description != null || priority != null || dueDate != null
                || assignedTechnicianId != null || cancelReason != null || status == MaintenanceStatus.CANCELLED;
    }
}
