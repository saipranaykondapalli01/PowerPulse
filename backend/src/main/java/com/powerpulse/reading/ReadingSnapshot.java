package com.powerpulse.reading;

import com.powerpulse.common.domain.ReadingSource;
import java.time.Instant;

public class ReadingSnapshot {

    private Double temperatureC;
    private Double oilLevelPct;
    private Double voltageV;
    private Double currentA;
    private Double loadPct;
    private Double powerFactor;
    private Instant recordedAt;
    private ReadingSource source;

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

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public ReadingSource getSource() {
        return source;
    }

    public void setSource(ReadingSource source) {
        this.source = source;
    }
}
