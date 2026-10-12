package com.powerpulse.simulation;

import com.powerpulse.common.SchedulerLockService;
import java.time.Duration;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Simulator heartbeat. Lease-locked so ticks never overlap. Does nothing unless {@code powerpulse.simulation.enabled},
 * {@code settings.simulation.enabled} and {@code state.running} are all true; the configured
 * {@code settings.simulation.intervalSeconds} is honored on top of this polling delay.
 */
@Component
public class SimulationJob {

    static final String JOB_NAME = "simulation-tick";
    static final Duration LEASE = Duration.ofMinutes(2);

    private final SchedulerLockService lockService;
    private final SimulationService simulationService;

    public SimulationJob(SchedulerLockService lockService, SimulationService simulationService) {
        this.lockService = lockService;
        this.simulationService = simulationService;
    }

    @Scheduled(fixedDelayString = "${powerpulse.simulation.interval-ms:10000}",
            initialDelayString = "${powerpulse.simulation.interval-ms:10000}")
    public void run() {
        lockService.tryRun(JOB_NAME, LEASE, simulationService::scheduledTick);
    }
}
