package com.powerpulse.maintenance;

import jakarta.validation.constraints.Size;

/** Mirrors {@code MaintenanceCompleteRequest} in frontend/src/types/api.ts. */
public record MaintenanceCompleteRequest(
        @Size(max = 4000) String inspectionFindings,
        @Size(max = 4000) String workNote) {
}
