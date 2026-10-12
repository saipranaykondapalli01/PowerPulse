package com.powerpulse.faulthistory;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertEvent;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.MaintenanceTaskRepository;
import com.powerpulse.reading.ReadingSnapshot;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Maintains the immutable fault-history record (one incident per alert, unique {@code alertId}). Every method
 * is idempotent and uses field-scoped updates so that concurrent callers do not overwrite each other.
 */
@Service
public class FaultIncidentServiceImpl implements FaultIncidentService {

    /** Maximum number of reading snapshots kept per incident (the opening reading is always kept). */
    static final int MAX_READINGS = 10;

    private final FaultIncidentRepository repository;
    private final MaintenanceTaskRepository maintenanceRepository;
    private final MongoTemplate mongoTemplate;

    public FaultIncidentServiceImpl(FaultIncidentRepository repository, MaintenanceTaskRepository maintenanceRepository,
                                    MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.maintenanceRepository = maintenanceRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void openFor(Alert alert, ReadingSnapshot openingReading) {
        if (repository.findByAlertId(alert.getId()).isPresent()) {
            return;
        }
        FaultIncident incident = newIncident(alert);
        if (openingReading != null) {
            incident.getReadings().add(openingReading);
        }
        try {
            repository.insert(incident);
        } catch (DuplicateKeyException alreadyOpen) {
            // Another execution opened it concurrently: idempotent no-op.
        }
    }

    @Override
    public void recordPeak(Alert alert, ReadingSnapshot reading) {
        Optional<FaultIncident> existing = repository.findByAlertId(alert.getId());
        if (existing.isEmpty()) {
            openFor(alert, reading);
            existing = repository.findByAlertId(alert.getId());
            if (existing.isEmpty()) {
                return;
            }
            if (reading != null) {
                // The opening reading is the peak reading; just refresh peak values below.
                reading = null;
            }
        }
        FaultIncident incident = existing.get();
        Update update = new Update();
        if (alert.getPeakValue() != null) {
            update.set("peakValue", alert.getPeakValue());
        }
        update.set("severity", peakSeverity(alert));
        update.set("updatedAt", Instant.now());
        if (reading != null) {
            List<ReadingSnapshot> readings = new ArrayList<>(
                    incident.getReadings() == null ? List.of() : incident.getReadings());
            readings.add(reading);
            while (readings.size() > MAX_READINGS) {
                // Keep the opening reading (index 0) and drop the oldest intermediate snapshot.
                readings.remove(1);
            }
            update.set("readings", readings);
        }
        mongoTemplate.updateFirst(byAlert(alert.getId()), update, FaultIncident.class);
    }

    @Override
    public void finalizeFor(Alert alert) {
        if (repository.findByAlertId(alert.getId()).isEmpty()) {
            openFor(alert, null);
        }
        FaultIncident incident = repository.findByAlertId(alert.getId()).orElse(null);
        if (incident == null) {
            return;
        }
        Instant resolvedAt = alert.getResolvedAt() != null ? alert.getResolvedAt() : Instant.now();
        Instant startedAt = incident.getStartedAt() != null ? incident.getStartedAt() : resolvedAt;
        long duration = Math.max(0, Duration.between(startedAt, resolvedAt).getSeconds());

        Set<String> maintenanceIds = new LinkedHashSet<>();
        if (incident.getMaintenanceIds() != null) {
            maintenanceIds.addAll(incident.getMaintenanceIds());
        }
        if (alert.getMaintenanceIds() != null) {
            maintenanceIds.addAll(alert.getMaintenanceIds());
        }

        Update update = new Update()
                .set("resolvedAt", resolvedAt)
                .set("durationSeconds", duration)
                .set("resolutionNotes", alert.getResolutionNotes())
                .set("severity", peakSeverity(alert))
                .set("recurrenceCount", alert.getRecurrenceCount())
                .set("maintenanceIds", new ArrayList<>(maintenanceIds))
                .set("actionsTaken", actionsTaken(alert, maintenanceIds))
                .set("updatedAt", Instant.now());
        if (alert.getPeakValue() != null) {
            update.set("peakValue", alert.getPeakValue());
        }
        mongoTemplate.updateFirst(byAlert(alert.getId()), update, FaultIncident.class);
    }

    @Override
    public void linkMaintenance(String alertId, String maintenanceId) {
        mongoTemplate.updateFirst(byAlert(alertId),
                new Update().addToSet("maintenanceIds", maintenanceId).set("updatedAt", Instant.now()),
                FaultIncident.class);
    }

    /** Human-readable trail derived from the alert's workflow events and linked maintenance tasks. */
    List<String> actionsTaken(Alert alert, Set<String> maintenanceIds) {
        List<String> actions = new ArrayList<>();
        boolean resolvedEvent = false;
        if (alert.getEvents() != null) {
            for (AlertEvent e : alert.getEvents()) {
                if (e.getType() == null) {
                    continue;
                }
                String actor = e.getActor() == null ? "system" : e.getActor();
                String when = e.getAt() == null ? "" : " at " + e.getAt().truncatedTo(ChronoUnit.SECONDS);
                String detail = e.getMessage() == null || e.getMessage().isBlank() ? "" : ": " + e.getMessage();
                switch (e.getType()) {
                    case "ACKNOWLEDGED" -> actions.add("Acknowledged by " + actor + when);
                    case "ASSIGNED" -> actions.add("Assigned by " + actor + when + detail);
                    case "STATUS_CHANGED" -> actions.add("Status changed by " + actor + when + detail);
                    case "ESCALATED" -> actions.add("Escalated" + when + detail);
                    case "RECOVERED" -> actions.add("Readings returned to normal" + when);
                    case "RESOLVED" -> {
                        resolvedEvent = true;
                        actions.add("Resolved by " + actor + when + detail);
                    }
                    default -> {
                        // CREATED and MAINTENANCE_LINKED are covered by the incident itself / the task list below.
                    }
                }
            }
        }
        if (!resolvedEvent && alert.getResolvedBy() != null) {
            actions.add("Resolved by " + alert.getResolvedBy());
        }
        if (!maintenanceIds.isEmpty()) {
            for (MaintenanceTask task : maintenanceRepository.findAllById(maintenanceIds)) {
                actions.add("Maintenance task \"" + task.getTitle() + "\" (" + task.getStatus() + ")");
            }
        }
        return actions;
    }

    private FaultIncident newIncident(Alert alert) {
        FaultIncident incident = new FaultIncident();
        incident.setAlertId(alert.getId());
        incident.setTransformerId(alert.getTransformerId());
        incident.setTransformerCode(alert.getTransformerCode());
        incident.setLocation(alert.getLocation());
        incident.setFaultType(alert.getFaultType());
        incident.setSeverity(peakSeverity(alert));
        Instant now = Instant.now();
        incident.setStartedAt(alert.getCreatedAt() != null ? alert.getCreatedAt() : now);
        incident.setPeakValue(alert.getPeakValue() != null ? alert.getPeakValue() : alert.getMeasuredValue());
        incident.setThreshold(alert.getThreshold());
        incident.setUnit(alert.getUnit());
        incident.setRecurrenceCount(alert.getRecurrenceCount());
        if (alert.getMaintenanceIds() != null) {
            incident.setMaintenanceIds(new ArrayList<>(alert.getMaintenanceIds()));
        }
        incident.setCreatedAt(now);
        incident.setUpdatedAt(now);
        return incident;
    }

    private static com.powerpulse.common.domain.Severity peakSeverity(Alert alert) {
        return alert.getPeakSeverity() != null ? alert.getPeakSeverity() : alert.getSeverity();
    }

    private static Query byAlert(String alertId) {
        return Query.query(Criteria.where("alertId").is(alertId));
    }
}
