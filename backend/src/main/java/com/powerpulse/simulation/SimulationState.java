package com.powerpulse.simulation;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("simulation_state")
public class SimulationState {

    @Id
    private String id = "global";
    private boolean running;
    private String runId;
    private long tick;
    private Map<String, ActiveScenario> scenarios = new HashMap<>();
    private Instant updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public boolean isRunning() {
        return running;
    }

    public void setRunning(boolean running) {
        this.running = running;
    }

    public String getRunId() {
        return runId;
    }

    public void setRunId(String runId) {
        this.runId = runId;
    }

    public long getTick() {
        return tick;
    }

    public void setTick(long tick) {
        this.tick = tick;
    }

    public Map<String, ActiveScenario> getScenarios() {
        return scenarios;
    }

    public void setScenarios(Map<String, ActiveScenario> scenarios) {
        this.scenarios = scenarios;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
