package com.powerpulse.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Mirrors {@code MaintenanceCreateRequest} in frontend/src/types/api.ts. */
public record MaintenanceCreateRequest(
        @NotBlank String transformerId,
        String alertId,
        @NotBlank @Size(max = 200) String title,
        @Size(max = 4000) String description,
        @NotNull Priority priority,
        String assignedTechnicianId,
        @NotNull Instant dueDate) {
}
