package com.powerpulse.alert;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import java.time.Instant;
import java.util.List;

/** Mirror of {@code AlertDto} in frontend/src/types/api.ts. */
public record AlertDto(
        String id,
        String transformerId,
        String transformerCode,
        String transformerName,
        String location,
        FaultType faultType,
        Severity severity,
        Severity peakSeverity,
        String description,
        Double measuredValue,
        Double peakValue,
        Double threshold,
        String unit,
        AlertStatus status,
        boolean active,
        String incidentKey,
        String assignedUserId,
        String assignedUserName,
        Instant acknowledgedAt,
        String acknowledgedBy,
        Instant resolvedAt,
        String resolvedBy,
        String resolutionNotes,
        boolean recovered,
        Instant recoveredAt,
        int recurrenceCount,
        List<AlertEventDto> events,
        List<String> maintenanceIds,
        Instant createdAt,
        Instant updatedAt) {

    /** Mirror of {@code AlertEvent} in frontend/src/types/api.ts. */
    public record AlertEventDto(Instant at, String type, String message, String actor) {
    }

    public static AlertDto from(Alert a) {
        List<AlertEventDto> events = a.getEvents() == null ? List.of() : a.getEvents().stream()
                .map(e -> new AlertEventDto(e.getAt(), e.getType(), e.getMessage(), e.getActor()))
                .toList();
        return new AlertDto(a.getId(), a.getTransformerId(), a.getTransformerCode(), a.getTransformerName(),
                a.getLocation(), a.getFaultType(), a.getSeverity(), a.getPeakSeverity(), a.getDescription(),
                a.getMeasuredValue(), a.getPeakValue(), a.getThreshold(), a.getUnit() == null ? "" : a.getUnit(),
                a.getStatus(), a.isActive(), a.getIncidentKey(), a.getAssignedUserId(), a.getAssignedUserName(),
                a.getAcknowledgedAt(), a.getAcknowledgedBy(), a.getResolvedAt(), a.getResolvedBy(),
                a.getResolutionNotes(), a.isRecovered(), a.getRecoveredAt(), a.getRecurrenceCount(), events,
                a.getMaintenanceIds() == null ? List.of() : List.copyOf(a.getMaintenanceIds()),
                a.getCreatedAt(), a.getUpdatedAt());
    }
}
