package com.powerpulse.faulthistory;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import java.time.Instant;
import java.util.List;

/** Mirrors {@code FaultIncidentDto} in frontend/src/types/api.ts. */
public record FaultIncidentDto(
        String id,
        String alertId,
        String transformerId,
        String transformerCode,
        String location,
        FaultType faultType,
        Severity severity,
        Instant startedAt,
        Instant resolvedAt,
        Long durationSeconds,
        Double peakValue,
        Double threshold,
        String unit,
        List<ReadingSnapshotDto> readings,
        List<String> actionsTaken,
        int recurrenceCount,
        List<String> maintenanceIds,
        String resolutionNotes) {

    /** Mirrors {@code ReadingSnapshot} in frontend/src/types/api.ts. */
    public record ReadingSnapshotDto(Double temperatureC, Double oilLevelPct, Double voltageV, Double currentA,
                                     Double loadPct, Double powerFactor, Instant recordedAt, ReadingSource source) {

        static ReadingSnapshotDto from(ReadingSnapshot s) {
            return new ReadingSnapshotDto(s.getTemperatureC(), s.getOilLevelPct(), s.getVoltageV(), s.getCurrentA(),
                    s.getLoadPct(), s.getPowerFactor(), s.getRecordedAt(), s.getSource());
        }
    }

    public static FaultIncidentDto from(FaultIncident i) {
        return new FaultIncidentDto(i.getId(), i.getAlertId(), i.getTransformerId(), i.getTransformerCode(),
                i.getLocation(), i.getFaultType(), i.getSeverity(), i.getStartedAt(), i.getResolvedAt(),
                i.getDurationSeconds(), i.getPeakValue(), i.getThreshold(), i.getUnit(),
                i.getReadings() == null ? List.of() : i.getReadings().stream().map(ReadingSnapshotDto::from).toList(),
                i.getActionsTaken() == null ? List.of() : List.copyOf(i.getActionsTaken()),
                i.getRecurrenceCount(),
                i.getMaintenanceIds() == null ? List.of() : List.copyOf(i.getMaintenanceIds()),
                i.getResolutionNotes());
    }
}
