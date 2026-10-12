package com.powerpulse.dashboard;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import java.time.Instant;

/** Mirrors {@code IncidentSummary} in frontend/src/types/api.ts. */
public record IncidentSummary(
        String alertId,
        String transformerId,
        String transformerCode,
        FaultType faultType,
        Severity severity,
        AlertStatus status,
        Instant createdAt) {

    public static IncidentSummary from(Alert a) {
        return new IncidentSummary(a.getId(), a.getTransformerId(), a.getTransformerCode(), a.getFaultType(),
                a.getSeverity(), a.getStatus(), a.getCreatedAt());
    }
}
