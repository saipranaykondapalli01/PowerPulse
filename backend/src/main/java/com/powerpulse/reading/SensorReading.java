package com.powerpulse.reading;

import com.powerpulse.common.domain.ReadingSource;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("sensor_readings")
@CompoundIndex(name = "transformer_recorded", def = "{'transformerId': 1, 'recordedAt': -1}")
public class SensorReading {

    @Id
    private String id;
    private String transformerId;
    private Double temperatureC;
    private Double oilLevelPct;
    private Double voltageV;
    private Double currentA;
    private Double loadPct;
    private Double powerFactor;
    private ReadingSource source;
    private String simulationId;
    private String scenario;
    /** TTL index created by {@code config.MongoIndexConfig} from {@code powerpulse.retention.reading-days}. */
    private Instant recordedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTransformerId() {
        return transformerId;
    }

    public void setTransformerId(String transformerId) {
        this.transformerId = transformerId;
    }

    public Double getTemperatureC() {
        return temperatureC;
    }

    public void setTemperatureC(Double temperatureC) {
        this.temperatureC = temperatureC;
    }

    public Double getOilLevelPct() {
        return oilLevelPct;
    }

    public void setOilLevelPct(Double oilLevelPct) {
        this.oilLevelPct = oilLevelPct;
    }

    public Double getVoltageV() {
        return voltageV;
    }

    public void setVoltageV(Double voltageV) {
        this.voltageV = voltageV;
    }

    public Double getCurrentA() {
        return currentA;
    }

    public void setCurrentA(Double currentA) {
        this.currentA = currentA;
    }

    public Double getLoadPct() {
        return loadPct;
    }

    public void setLoadPct(Double loadPct) {
        this.loadPct = loadPct;
    }

    public Double getPowerFactor() {
        return powerFactor;
    }

    public void setPowerFactor(Double powerFactor) {
        this.powerFactor = powerFactor;
    }

    public ReadingSource getSource() {
        return source;
    }

    public void setSource(ReadingSource source) {
        this.source = source;
    }

    public String getSimulationId() {
        return simulationId;
    }

    public void setSimulationId(String simulationId) {
        this.simulationId = simulationId;
    }

    public String getScenario() {
        return scenario;
    }

    public void setScenario(String scenario) {
        this.scenario = scenario;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }
}
