package com.powerpulse.reading;

import com.powerpulse.common.domain.ReadingSource;
import java.time.Instant;

/** Reading API records; each mirrors the same-named type in frontend/src/types/api.ts. */
public final class ReadingDtos {

    private ReadingDtos() {
    }

    public record ReadingDto(
            String id,
            String transformerId,
            Double temperatureC,
            Double oilLevelPct,
            Double voltageV,
            Double currentA,
            Double loadPct,
            Double powerFactor,
            ReadingSource source,
            String simulationId,
            String scenario,
            Instant recordedAt) {

        public static ReadingDto from(SensorReading r) {
            return new ReadingDto(r.getId(), r.getTransformerId(), r.getTemperatureC(), r.getOilLevelPct(),
                    r.getVoltageV(), r.getCurrentA(), r.getLoadPct(), r.getPowerFactor(), r.getSource(),
                    r.getSimulationId(), r.getScenario(), r.getRecordedAt());
        }
    }

    /**
     * Device ingestion body for POST /readings. Either {@code transformerId} or {@code transformerCode} is required.
     * Physically impossible or missing metric values are accepted and flagged as SENSOR_FAILURE.
     */
    public record ReadingInput(
            String transformerId,
            String transformerCode,
            Double temperatureC,
            Double oilLevelPct,
            Double voltageV,
            Double currentA,
            Double loadPct,
            Double powerFactor,
            Instant recordedAt) {
    }
}
