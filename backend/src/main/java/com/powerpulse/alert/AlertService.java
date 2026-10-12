package com.powerpulse.alert;

import com.powerpulse.alert.AlertRequests.AlertAssignRequest;
import com.powerpulse.alert.AlertRequests.AlertResolveRequest;
import com.powerpulse.alert.AlertRequests.AlertUpdateRequest;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.fault.FaultEvaluation;
import com.powerpulse.fault.FaultFinding;
import com.powerpulse.faulthistory.FaultIncidentService;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.transformer.QuerySupport;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStateService;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

/**
 * Alert lifecycle: automatic reconciliation of fault findings (dedup, escalation, recovery, recurrence — see
 * docs/development-plan.md) and the human workflow (acknowledge, progress, assign, resolve).
 */
@Service
public class AlertService implements AlertLinkService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    static final int MAX_ATTEMPTS = 4;
    static final Set<String> SORTABLE = Set.of("createdAt", "severity", "status", "transformerCode");
    static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"));
    private static final Map<String, List<String>> ENUM_RANKS = Map.of(
            "severity", QuerySupport.names(Severity.values()),
            "status", QuerySupport.names(AlertStatus.values()));

    /** Side effects to run after a successful alert save. */
    enum Effect { SAVE, RECORD_PEAK, NOTIFY_CRITICAL, RESOLVED, NOT_ACTIVE }

    @FunctionalInterface
    interface Mutation {
        /** Applies the change in place; returns the effects (empty = nothing to save). */
        EnumSet<Effect> apply(Alert alert);
    }

    record Mutated(Alert alert, EnumSet<Effect> effects) {
    }

    /** The active alert after opening or updating it, and whether it was just opened. */
    public record AlertOutcome(Alert alert, boolean created) {
    }

    private final AlertRepository alertRepository;
    private final MongoTemplate mongoTemplate;
    private final FaultIncidentService incidentService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final TransformerStateService transformerStateService;
    private final SettingsService settingsService;
    private final UserRepository userRepository;
    private final Clock clock;

    @Autowired
    public AlertService(AlertRepository alertRepository, MongoTemplate mongoTemplate,
                        FaultIncidentService incidentService, NotificationService notificationService,
                        AuditService auditService, TransformerStateService transformerStateService,
                        SettingsService settingsService, UserRepository userRepository) {
        this(alertRepository, mongoTemplate, incidentService, notificationService, auditService,
                transformerStateService, settingsService, userRepository, Clock.systemUTC());
    }

    public AlertService(AlertRepository alertRepository, MongoTemplate mongoTemplate,
                        FaultIncidentService incidentService, NotificationService notificationService,
                        AuditService auditService, TransformerStateService transformerStateService,
                        SettingsService settingsService, UserRepository userRepository, Clock clock) {
        this.alertRepository = alertRepository;
        this.mongoTemplate = mongoTemplate;
        this.incidentService = incidentService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.transformerStateService = transformerStateService;
        this.settingsService = settingsService;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    // =====================================================================================================
    // Automatic reconciliation
    // =====================================================================================================

    /**
     * Applies one reading's evaluation to the transformer's alerts. Does not refresh transformer state; the caller
     * (ingestion pipeline) does that afterwards.
     */
    public void reconcile(Transformer t, FaultEvaluation evaluation, ReadingSnapshot reading) {
        Map<FaultType, Alert> active = new EnumMap<>(FaultType.class);
        for (Alert a : alertRepository.findByTransformerIdAndActiveTrue(t.getId())) {
            active.put(a.getFaultType(), a);
        }
        for (FaultFinding f : evaluation.findings()) {
            Alert existing = active.get(f.faultType());
            if (existing == null) {
                open(t, f, reading);
            } else {
                applyFinding(t, existing, f, reading);
            }
        }
        for (FaultType type : evaluation.evaluated()) {
            if (evaluation.finding(type).isPresent()) {
                continue;
            }
            Alert existing = active.get(type);
            if (existing != null) {
                applyNormal(existing, reading);
            }
        }
    }

    /** Opens or updates the STALE_READING alert for a transformer that stopped reporting. */
    public AlertOutcome reconcileStale(Transformer t, FaultFinding finding) {
        String key = incidentKey(t.getId(), FaultType.STALE_READING);
        Optional<Alert> existing = alertRepository.findByIncidentKeyAndActiveTrue(key);
        if (existing.isPresent()) {
            return new AlertOutcome(applyFinding(t, existing.get(), finding, t.getLatestReading()), false);
        }
        return open(t, finding, t.getLatestReading());
    }

    private AlertOutcome open(Transformer t, FaultFinding f, ReadingSnapshot reading) {
        Instant now = Instant.now(clock);
        String key = incidentKey(t.getId(), f.faultType());
        Alert a = new Alert();
        a.setTransformerId(t.getId());
        a.setTransformerCode(t.getCode());
        a.setTransformerName(t.getName());
        a.setLocation(t.getLocation());
        a.setFaultType(f.faultType());
        a.setSeverity(f.severity());
        a.setPeakSeverity(f.severity());
        a.setDescription(f.description());
        a.setMeasuredValue(f.measuredValue());
        a.setPeakValue(f.measuredValue());
        a.setThreshold(f.threshold());
        a.setUnit(f.unit() == null ? "" : f.unit());
        a.setStatus(AlertStatus.NEW);
        a.setActive(true);
        a.setIncidentKey(key);
        a.setConsecutiveNormalCount(0);
        a.setRecurrenceCount((int) alertRepository.countByIncidentKeyAndActiveFalse(key));
        a.getEvents().add(event(now, "CREATED", f.severity() + " " + f.faultType() + ": " + f.description(),
                CurrentUser.SYSTEM));
        Alert saved;
        try {
            saved = alertRepository.insert(a);
        } catch (DuplicateKeyException alreadyOpen) {
            // Another execution opened the same incident concurrently: continue with that alert.
            Optional<Alert> current = alertRepository.findByIncidentKeyAndActiveTrue(key);
            if (current.isEmpty()) {
                throw alreadyOpen;
            }
            return new AlertOutcome(applyFinding(t, current.get(), f, reading), false);
        }
        safely("open incident", () -> incidentService.openFor(saved, reading));
        if (saved.getSeverity() == Severity.CRITICAL) {
            safely("critical notification", () -> notificationService.notifyNewCriticalAlert(saved));
        }
        return new AlertOutcome(saved, true);
    }

    private Alert applyFinding(Transformer t, Alert initial, FaultFinding f, ReadingSnapshot reading) {
        Optional<Mutated> result = mutate(initial, a -> {
            if (!a.isActive()) {
                return EnumSet.of(Effect.NOT_ACTIVE);
            }
            EnumSet<Effect> effects = EnumSet.noneOf(Effect.class);
            Instant now = Instant.now(clock);
            if (!equalsNullable(a.getMeasuredValue(), f.measuredValue()) || a.getConsecutiveNormalCount() != 0) {
                a.setMeasuredValue(f.measuredValue());
                a.setConsecutiveNormalCount(0);
                effects.add(Effect.SAVE);
            }
            if (isWorse(a.getFaultType(), f.measuredValue(), a.getPeakValue(), t.getSecondaryVoltageV())) {
                a.setPeakValue(f.measuredValue());
                effects.add(Effect.SAVE);
                effects.add(Effect.RECORD_PEAK);
            }
            if (a.isRecovered()) {
                a.setRecovered(false);
                a.setRecoveredAt(null);
                a.getEvents().add(event(now, "STATUS_CHANGED",
                        "Readings left the normal range again; recovery flag cleared", CurrentUser.SYSTEM));
                effects.add(Effect.SAVE);
            }
            if (f.severity().isHigherThan(a.getSeverity())) {
                Severity previous = a.getSeverity();
                a.setSeverity(f.severity());
                a.setThreshold(f.threshold());
                a.setDescription(f.description());
                if (a.getPeakSeverity() == null || f.severity().isHigherThan(a.getPeakSeverity())) {
                    a.setPeakSeverity(f.severity());
                }
                a.getEvents().add(event(now, "ESCALATED", "Severity escalated from " + previous + " to "
                        + f.severity() + ": " + f.description(), CurrentUser.SYSTEM));
                effects.add(Effect.SAVE);
                effects.add(Effect.RECORD_PEAK);
                if (f.severity() == Severity.CRITICAL) {
                    effects.add(Effect.NOTIFY_CRITICAL);
                }
            }
            return effects;
        });
        if (result.isEmpty()) {
            return open(t, f, reading).alert();
        }
        Mutated m = result.get();
        if (m.effects().contains(Effect.NOT_ACTIVE)) {
            // Resolved concurrently; the finding is a recurrence.
            return open(t, f, reading).alert();
        }
        runEffects(m, reading);
        return m.alert();
    }

    private void applyNormal(Alert initial, ReadingSnapshot reading) {
        int required = Math.max(1, settingsService.current().getRecoveryReadings());
        Optional<Mutated> result = mutate(initial, a -> {
            if (!a.isActive()) {
                return EnumSet.of(Effect.NOT_ACTIVE);
            }
            EnumSet<Effect> effects = EnumSet.of(Effect.SAVE);
            Instant now = Instant.now(clock);
            a.setConsecutiveNormalCount(a.getConsecutiveNormalCount() + 1);
            if (a.getConsecutiveNormalCount() >= required) {
                if (a.getStatus() == AlertStatus.NEW) {
                    String notes = "Auto-resolved: " + a.getConsecutiveNormalCount()
                            + " consecutive readings within normal range.";
                    a.setStatus(AlertStatus.RESOLVED);
                    a.setActive(false);
                    a.setResolvedAt(now);
                    a.setResolvedBy(CurrentUser.SYSTEM);
                    a.setResolutionNotes(notes);
                    a.getEvents().add(event(now, "RESOLVED", notes, CurrentUser.SYSTEM));
                    effects.add(Effect.RESOLVED);
                } else if (!a.isRecovered()) {
                    a.setRecovered(true);
                    a.setRecoveredAt(now);
                    a.getEvents().add(event(now, "RECOVERED", a.getConsecutiveNormalCount()
                            + " consecutive readings within normal range; awaiting resolution by a user",
                            CurrentUser.SYSTEM));
                }
            }
            return effects;
        });
        result.filter(m -> !m.effects().contains(Effect.NOT_ACTIVE)).ifPresent(m -> {
            runEffects(m, reading);
            if (m.effects().contains(Effect.RESOLVED)) {
                safely("audit", () -> auditService.record("ALERT_AUTO_RESOLVED", ResourceType.ALERT,
                        m.alert().getId(), m.alert().getTransformerCode() + " " + m.alert().getFaultType()
                                + " auto-resolved after recovery"));
            }
        });
    }

    private void runEffects(Mutated m, ReadingSnapshot reading) {
        Alert a = m.alert();
        if (m.effects().contains(Effect.RECORD_PEAK) && reading != null) {
            safely("record peak", () -> incidentService.recordPeak(a, reading));
        }
        if (m.effects().contains(Effect.NOTIFY_CRITICAL)) {
            safely("critical notification", () -> notificationService.notifyNewCriticalAlert(a));
        }
        if (m.effects().contains(Effect.RESOLVED)) {
            safely("finalize incident", () -> incidentService.finalizeFor(a));
            safely("resolved notification", () -> notificationService.notifyIncidentResolved(a));
        }
    }

    /**
     * Applies a mutation with optimistic-lock retries: on conflict the alert is re-read and the mutation re-applied
     * to the fresh state. Returns empty if the alert disappeared.
     */
    Optional<Mutated> mutate(Alert initial, Mutation mutation) {
        Alert current = initial;
        for (int attempt = 1; ; attempt++) {
            EnumSet<Effect> effects = mutation.apply(current);
            if (!effects.contains(Effect.SAVE)) {
                return Optional.of(new Mutated(current, effects));
            }
            try {
                return Optional.of(new Mutated(alertRepository.save(current), effects));
            } catch (OptimisticLockingFailureException conflict) {
                if (attempt >= MAX_ATTEMPTS) {
                    throw conflict;
                }
                Optional<Alert> fresh = alertRepository.findById(initial.getId());
                if (fresh.isEmpty()) {
                    return Optional.empty();
                }
                current = fresh.get();
            }
        }
    }

    /** Whether {@code candidate} is a worse observation than {@code current} for the fault type. */
    static boolean isWorse(FaultType type, Double candidate, Double current, double ratedVoltage) {
        if (candidate == null || type == FaultType.SENSOR_FAILURE) {
            return false;
        }
        if (current == null) {
            return true;
        }
        return switch (type) {
            case LOW_OIL_LEVEL -> candidate < current;
            case ABNORMAL_VOLTAGE -> Math.abs(candidate - ratedVoltage) > Math.abs(current - ratedVoltage);
            default -> candidate > current;
        };
    }

    // =====================================================================================================
    // Workflow API
    // =====================================================================================================

    public record AlertFilter(String q, AlertStatus status, Severity severity, FaultType faultType,
                              String transformerId, String location, Boolean active, Instant from, Instant to) {
    }

    public PageResponse<AlertDto> list(AlertFilter f, Pageable requested) {
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        List<Criteria> and = new ArrayList<>();
        if (QuerySupport.hasText(f.q())) {
            var p = QuerySupport.containsIgnoreCase(f.q());
            and.add(new Criteria().orOperator(Criteria.where("transformerCode").regex(p),
                    Criteria.where("transformerName").regex(p), Criteria.where("description").regex(p)));
        }
        if (f.status() != null) {
            and.add(Criteria.where("status").is(f.status().name()));
        }
        if (f.severity() != null) {
            and.add(Criteria.where("severity").is(f.severity().name()));
        }
        if (f.faultType() != null) {
            and.add(Criteria.where("faultType").is(f.faultType().name()));
        }
        if (QuerySupport.hasText(f.transformerId())) {
            and.add(Criteria.where("transformerId").is(f.transformerId()));
        }
        if (QuerySupport.hasText(f.location())) {
            and.add(Criteria.where("location").is(f.location()));
        }
        if (f.active() != null) {
            and.add(Criteria.where("active").is(f.active()));
        }
        if (f.from() != null) {
            and.add(Criteria.where("createdAt").gte(f.from()));
        }
        if (f.to() != null) {
            and.add(Criteria.where("createdAt").lte(f.to()));
        }
        Criteria criteria = and.isEmpty() ? new Criteria() : new Criteria().andOperator(and);
        Page<Alert> page = QuerySupport.page(mongoTemplate, criteria, pageable, Alert.class, "alerts", ENUM_RANKS);
        return PageResponse.of(page, AlertDto::from);
    }

    public AlertDto get(String id) {
        return AlertDto.from(load(id));
    }

    public List<AlertDto> forTransformer(String transformerId, Boolean active) {
        List<Alert> alerts = Boolean.TRUE.equals(active)
                ? alertRepository.findByTransformerIdAndActiveTrue(transformerId)
                : alertRepository.findByTransformerIdOrderByCreatedAtDesc(transformerId);
        return alerts.stream()
                .filter(a -> active == null || a.isActive() == active)
                .sorted((x, y) -> compareDesc(x.getCreatedAt(), y.getCreatedAt()))
                .map(AlertDto::from)
                .toList();
    }

    /** Forward-only status change NEW → ACKNOWLEDGED → IN_PROGRESS. RESOLVED only via {@link #resolve}. */
    public AlertDto updateStatus(String id, AlertUpdateRequest request) {
        AlertStatus target = request == null ? null : request.status();
        if (target == null) {
            throw new BadRequestException("status is required");
        }
        if (target == AlertStatus.RESOLVED) {
            throw new ConflictException("Use the resolve action (with resolution notes) to resolve an alert");
        }
        String actor = CurrentUser.nameOrSystem();
        Alert saved = workflow(id, a -> {
            requireActive(a);
            if (target.ordinal() <= a.getStatus().ordinal()) {
                throw new ConflictException("Illegal status transition " + a.getStatus() + " → " + target);
            }
            Instant now = Instant.now(clock);
            if (a.getAcknowledgedAt() == null) {
                a.setAcknowledgedAt(now);
                a.setAcknowledgedBy(actor);
            }
            a.getEvents().add(event(now, "STATUS_CHANGED", "Status changed from " + a.getStatus() + " to " + target,
                    actor));
            a.setStatus(target);
        });
        auditService.record("ALERT_STATUS_CHANGED", ResourceType.ALERT, id,
                saved.getTransformerCode() + " " + saved.getFaultType() + " → " + target);
        return AlertDto.from(saved);
    }

    public AlertDto acknowledge(String id) {
        String actor = CurrentUser.nameOrSystem();
        Alert saved = workflow(id, a -> {
            requireActive(a);
            if (a.getStatus() != AlertStatus.NEW) {
                throw new ConflictException("Only NEW alerts can be acknowledged (current status " + a.getStatus()
                        + ")");
            }
            Instant now = Instant.now(clock);
            a.setStatus(AlertStatus.ACKNOWLEDGED);
            a.setAcknowledgedAt(now);
            a.setAcknowledgedBy(actor);
            a.getEvents().add(event(now, "ACKNOWLEDGED", "Acknowledged by " + actor, actor));
        });
        auditService.record("ALERT_ACKNOWLEDGED", ResourceType.ALERT, id,
                saved.getTransformerCode() + " " + saved.getFaultType() + " acknowledged");
        return AlertDto.from(saved);
    }

    public AlertDto assign(String id, AlertAssignRequest request) {
        if (request == null || !QuerySupport.hasText(request.userId())) {
            throw new BadRequestException("userId is required");
        }
        User user = userRepository.findById(request.userId())
                .filter(User::isActive)
                .orElseThrow(() -> new BadRequestException("Assignee must be an existing, active user"));
        String actor = CurrentUser.nameOrSystem();
        Alert saved = workflow(id, a -> {
            requireActive(a);
            Instant now = Instant.now(clock);
            a.setAssignedUserId(user.getId());
            a.setAssignedUserName(user.getName());
            a.getEvents().add(event(now, "ASSIGNED", "Assigned to " + user.getName(), actor));
            if (a.getStatus() == AlertStatus.NEW) {
                a.setStatus(AlertStatus.ACKNOWLEDGED);
                a.setAcknowledgedAt(now);
                a.setAcknowledgedBy(actor);
                a.getEvents().add(event(now, "ACKNOWLEDGED", "Acknowledged on assignment", actor));
            }
        });
        auditService.record("ALERT_ASSIGNED", ResourceType.ALERT, id,
                saved.getTransformerCode() + " " + saved.getFaultType() + " assigned to " + user.getName());
        return AlertDto.from(saved);
    }

    public AlertDto resolve(String id, AlertResolveRequest request) {
        String notes = request == null || request.resolutionNotes() == null ? "" : request.resolutionNotes().trim();
        if (notes.length() < 5) {
            throw new BadRequestException("resolutionNotes must contain at least 5 characters");
        }
        String actor = CurrentUser.nameOrSystem();
        Alert saved = workflow(id, a -> {
            if (!a.isActive() || a.getStatus() == AlertStatus.RESOLVED) {
                throw new ConflictException("Alert is already resolved");
            }
            Instant now = Instant.now(clock);
            a.setStatus(AlertStatus.RESOLVED);
            a.setActive(false);
            a.setResolvedAt(now);
            a.setResolvedBy(actor);
            a.setResolutionNotes(notes);
            a.getEvents().add(event(now, "RESOLVED", "Resolved: " + notes, actor));
        });
        safely("finalize incident", () -> incidentService.finalizeFor(saved));
        safely("resolved notification", () -> notificationService.notifyIncidentResolved(saved));
        auditService.record("ALERT_RESOLVED", ResourceType.ALERT, id,
                saved.getTransformerCode() + " " + saved.getFaultType() + " resolved");
        return AlertDto.from(saved);
    }

    @Override
    public Alert linkMaintenance(String alertId, String maintenanceId) {
        String actor = CurrentUser.nameOrSystem();
        Alert initial = load(alertId);
        Mutated m = mutate(initial, a -> {
            if (a.getMaintenanceIds().contains(maintenanceId)) {
                return EnumSet.noneOf(Effect.class);
            }
            a.getMaintenanceIds().add(maintenanceId);
            a.getEvents().add(event(Instant.now(clock), "MAINTENANCE_LINKED",
                    "Maintenance task " + maintenanceId + " linked", actor));
            return EnumSet.of(Effect.SAVE);
        }).orElseThrow(() -> new NotFoundException("Alert", alertId));
        incidentService.linkMaintenance(alertId, maintenanceId);
        return m.alert();
    }

    // ---------- helpers ----------

    private interface WorkflowStep {
        void apply(Alert a);
    }

    /** Runs a user-driven transition (validation inside the step re-runs on retry) and refreshes the transformer. */
    private Alert workflow(String id, WorkflowStep step) {
        Alert initial = load(id);
        Alert saved = mutate(initial, a -> {
            step.apply(a);
            return EnumSet.of(Effect.SAVE);
        }).orElseThrow(() -> new NotFoundException("Alert", id)).alert();
        transformerStateService.refresh(saved.getTransformerId());
        return saved;
    }

    private Alert load(String id) {
        return alertRepository.findById(id).orElseThrow(() -> new NotFoundException("Alert", id));
    }

    private static void requireActive(Alert a) {
        if (!a.isActive() || a.getStatus() == AlertStatus.RESOLVED) {
            throw new ConflictException("Alert is already resolved");
        }
    }

    public static String incidentKey(String transformerId, FaultType type) {
        return transformerId + ":" + type.name();
    }

    private static AlertEvent event(Instant at, String type, String message, String actor) {
        AlertEvent e = new AlertEvent();
        e.setAt(at);
        e.setType(type);
        e.setMessage(message);
        e.setActor(actor);
        return e;
    }

    private static boolean equalsNullable(Double a, Double b) {
        return a == null ? b == null : a.equals(b);
    }

    private static int compareDesc(Instant x, Instant y) {
        if (x == null) {
            return y == null ? 0 : 1;
        }
        return y == null ? -1 : y.compareTo(x);
    }

    private static void safely(String what, Runnable r) {
        try {
            r.run();
        } catch (RuntimeException e) {
            log.warn("Alert side effect '{}' failed: {}", what, e.toString(), e);
        }
    }
}
