package com.powerpulse;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStatus;
import java.time.Instant;

/** Shared fixtures for unit tests. */
public final class TestData {

    public static final Instant NOW = Instant.parse("2026-10-01T12:00:00Z");

    private TestData() {
    }

    /** 500 kVA, 11 kV / 415 V transformer (I_rated ≈ 695.6 A). */
    public static Transformer transformer(String id, String code) {
        Transformer t = new Transformer();
        t.setId(id);
        t.setCode(code);
        t.setName("Test " + code);
        t.setLocation("North Ridge");
        t.setRatedCapacityKva(500);
        t.setPrimaryVoltageKv(11);
        t.setSecondaryVoltageV(415);
        t.setStatus(TransformerStatus.HEALTHY);
        t.setCreatedAt(NOW.minusSeconds(86_400));
        return t;
    }

    /** A reading at nominal values well inside all default thresholds. */
    public static ReadingSnapshot normal() {
        return reading(60.0, 90.0, 415.0, 300.0, 50.0, 0.95);
    }

    public static ReadingSnapshot reading(Double temp, Double oil, Double volt, Double curr, Double load, Double pf) {
        ReadingSnapshot r = new ReadingSnapshot();
        r.setTemperatureC(temp);
        r.setOilLevelPct(oil);
        r.setVoltageV(volt);
        r.setCurrentA(curr);
        r.setLoadPct(load);
        r.setPowerFactor(pf);
        r.setRecordedAt(NOW);
        r.setSource(ReadingSource.SIMULATED);
        return r;
    }

    public static Alert alert(String id, String transformerId, FaultType type, Severity severity, AlertStatus status) {
        Alert a = new Alert();
        a.setId(id);
        a.setTransformerId(transformerId);
        a.setTransformerCode("PP-TX-001");
        a.setFaultType(type);
        a.setSeverity(severity);
        a.setPeakSeverity(severity);
        a.setStatus(status);
        a.setActive(status != AlertStatus.RESOLVED);
        a.setIncidentKey(transformerId + ":" + type.name());
        a.setUnit("°C");
        return a;
    }
}
