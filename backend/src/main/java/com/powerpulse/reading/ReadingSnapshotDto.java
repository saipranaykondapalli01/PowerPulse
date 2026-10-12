package com.powerpulse.reading;

import com.powerpulse.common.domain.ReadingSource;
import java.time.Instant;

/** Mirror of {@code ReadingSnapshot} in frontend/src/types/api.ts. */
public record ReadingSnapshotDto(Double temperatureC, Double oilLevelPct, Double voltageV, Double currentA,
                                 Double loadPct, Double powerFactor, Instant recordedAt, ReadingSource source) {

    public static ReadingSnapshotDto from(ReadingSnapshot s) {
        if (s == null) {
            return null;
        }
        return new ReadingSnapshotDto(s.getTemperatureC(), s.getOilLevelPct(), s.getVoltageV(), s.getCurrentA(),
                s.getLoadPct(), s.getPowerFactor(), s.getRecordedAt(), s.getSource());
    }
}
