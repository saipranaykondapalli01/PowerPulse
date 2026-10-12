package com.powerpulse.support;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.faulthistory.FaultIncident;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.reading.SensorReading;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStatus;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.audit.AuditLog;
import com.powerpulse.common.SchedulerLock;
import com.powerpulse.notification.Notification;
import java.time.Instant;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

/** In-memory builders for test documents. */
public final class Fixtures {

    private Fixtures() {
    }

    /** Removes all documents from every collection touched by the workflow tests (indexes are kept). */
    public static void clean(MongoTemplate mongoTemplate) {
        for (Class<?> type : new Class<?>[] {Transformer.class, User.class, Alert.class, MaintenanceTask.class,
                Notification.class, FaultIncident.class, AuditLog.class, SensorReading.class, SchedulerLock.class}) {
            mongoTemplate.remove(new Query(), type);
        }
    }

    public static Transformer transformer(String code, String location, TransformerStatus status, int health,
                                          double kva, Double loadPct) {
        Transformer t = new Transformer();
        t.setCode(code);
        t.setName("Transformer " + code);
        t.setLocation(location);
        t.setStatus(status);
        t.setHealthScore(health);
        t.setRatedCapacityKva(kva);
        t.setPrimaryVoltageKv(11);
        t.setSecondaryVoltageV(415);
        if (loadPct != null) {
            ReadingSnapshot s = snapshot(Instant.now(), 60.0, loadPct);
            t.setLatestReading(s);
            t.setLastReadingAt(s.getRecordedAt());
        }
        return t;
    }

    public static ReadingSnapshot snapshot(Instant at, Double temp, Double load) {
        ReadingSnapshot s = new ReadingSnapshot();
        s.setTemperatureC(temp);
        s.setOilLevelPct(90.0);
        s.setVoltageV(415.0);
        s.setCurrentA(100.0);
        s.setLoadPct(load);
        s.setPowerFactor(0.95);
        s.setRecordedAt(at);
        s.setSource(ReadingSource.SIMULATED);
        return s;
    }

    public static User user(String name, Role role, String region, boolean active) {
        User u = new User();
        u.setName(name);
        u.setEmail(name.toLowerCase().replace(' ', '.') + "@test.local");
        u.setPasswordHash("x");
        u.setRole(role);
        u.setRegion(region);
        u.setActive(active);
        return u;
    }

    public static Alert alert(Transformer t, FaultType type, Severity severity, boolean active, Instant createdAt) {
        Alert a = new Alert();
        a.setTransformerId(t.getId());
        a.setTransformerCode(t.getCode());
        a.setTransformerName(t.getName());
        a.setLocation(t.getLocation());
        a.setFaultType(type);
        a.setSeverity(severity);
        a.setPeakSeverity(severity);
        a.setDescription(type + " on " + t.getCode());
        a.setMeasuredValue(95.0);
        a.setPeakValue(95.0);
        a.setThreshold(85.0);
        a.setUnit("°C");
        a.setStatus(active ? AlertStatus.NEW : AlertStatus.RESOLVED);
        a.setActive(active);
        a.setIncidentKey(t.getId() + ":" + type + (active ? "" : ":" + createdAt.toEpochMilli()));
        a.setCreatedAt(createdAt);
        a.setUpdatedAt(createdAt);
        return a;
    }

    public static MaintenanceTask task(Transformer t, String title, MaintenanceStatus status, Priority priority,
                                       Instant dueDate, Instant createdAt) {
        MaintenanceTask m = new MaintenanceTask();
        m.setTransformerId(t.getId());
        m.setTransformerCode(t.getCode());
        m.setTransformerName(t.getName());
        m.setLocation(t.getLocation());
        m.setTitle(title);
        m.setStatus(status);
        m.setPriority(priority);
        m.setDueDate(dueDate);
        m.setCreatedAt(createdAt);
        m.setUpdatedAt(createdAt);
        m.setCreatedById("creator-1");
        m.setCreatedByName("Creator");
        return m;
    }

    public static SensorReading reading(String transformerId, Instant at, double temp, double load) {
        SensorReading r = new SensorReading();
        r.setTransformerId(transformerId);
        r.setTemperatureC(temp);
        r.setOilLevelPct(90.0);
        r.setVoltageV(415.0);
        r.setCurrentA(100.0);
        r.setLoadPct(load);
        r.setPowerFactor(0.95);
        r.setSource(ReadingSource.SIMULATED);
        r.setRecordedAt(at);
        return r;
    }

    public static FaultIncident incident(Transformer t, FaultType type, Severity severity, Instant startedAt,
                                         Long durationSeconds) {
        FaultIncident i = new FaultIncident();
        i.setAlertId("alert-" + t.getCode() + "-" + type + "-" + startedAt.toEpochMilli());
        i.setTransformerId(t.getId());
        i.setTransformerCode(t.getCode());
        i.setLocation(t.getLocation());
        i.setFaultType(type);
        i.setSeverity(severity);
        i.setStartedAt(startedAt);
        if (durationSeconds != null) {
            i.setDurationSeconds(durationSeconds);
            i.setResolvedAt(startedAt.plusSeconds(durationSeconds));
        }
        i.setUnit("°C");
        return i;
    }
}
