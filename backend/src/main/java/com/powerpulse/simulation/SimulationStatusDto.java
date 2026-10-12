package com.powerpulse.simulation;

import java.time.Instant;
import java.util.List;

/** Mirror of {@code SimulationStatus} in frontend/src/types/api.ts. All simulator output is SIMULATED data. */
public record SimulationStatusDto(
        boolean enabled,
        boolean running,
        String runId,
        long tick,
        int intervalSeconds,
        List<ActiveScenarioDto> scenarios,
        List<String> availableScenarios,
        Instant lastTickAt) {

    /** Mirror of {@code ActiveScenarioDto}. */
    public record ActiveScenarioDto(String transformerId, String transformerCode, String name, Instant startedAt,
                                    int step) {
    }
}
