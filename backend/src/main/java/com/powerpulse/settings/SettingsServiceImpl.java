package com.powerpulse.settings;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ApiError;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.domain.ResourceType;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

/**
 * Cached access to the {@link SystemSettings} singleton. The defaults document is created on first access.
 * The cache is invalidated on every update made through this service.
 * Threshold values are configurable demo defaults, not universal electrical-safety limits.
 */
@Service
public class SettingsServiceImpl implements SettingsService {

    static final double WEIGHT_TOLERANCE = 0.01;

    private final SystemSettingsRepository repository;
    private final AuditService auditService;
    private final Clock clock;
    private volatile SystemSettings cached;

    @Autowired
    public SettingsServiceImpl(SystemSettingsRepository repository, AuditService auditService) {
        this(repository, auditService, Clock.systemUTC());
    }

    SettingsServiceImpl(SystemSettingsRepository repository, AuditService auditService, Clock clock) {
        this.repository = repository;
        this.auditService = auditService;
        this.clock = clock;
    }

    @Override
    public SystemSettings current() {
        SystemSettings s = cached;
        if (s == null) {
            s = loadOrCreate();
            cached = s;
        }
        return s;
    }

    public SystemSettingsDto get() {
        return SystemSettingsDto.from(current());
    }

    /** Applies a partial update; null fields are ignored. Throws {@link SettingsValidationException}. */
    public SystemSettingsDto update(SystemSettingsDto patch) {
        if (patch == null) {
            throw new SettingsValidationException(List.of(new ApiError.FieldError("body", "must not be empty")));
        }
        SystemSettings s = loadOrCreate();
        List<String> changed = merge(s, patch);
        List<ApiError.FieldError> errors = validate(s);
        if (!errors.isEmpty()) {
            throw new SettingsValidationException(errors);
        }
        s.setUpdatedAt(Instant.now(clock));
        s.setUpdatedBy(CurrentUser.nameOrSystem());
        SystemSettings saved = repository.save(s);
        cached = null;
        auditService.record("SETTINGS_UPDATED", ResourceType.SETTINGS, SystemSettings.GLOBAL_ID,
                changed.isEmpty() ? "Settings saved (no changes)" : "Updated settings: " + String.join(", ", changed));
        return SystemSettingsDto.from(saved);
    }

    /** Drops the cached copy (e.g. after a direct write by another component). */
    public void invalidate() {
        cached = null;
    }

    private SystemSettings loadOrCreate() {
        return repository.findById(SystemSettings.GLOBAL_ID).orElseGet(() -> {
            try {
                return repository.insert(new SystemSettings());
            } catch (DuplicateKeyException race) {
                return repository.findById(SystemSettings.GLOBAL_ID).orElseThrow();
            }
        });
    }

    // ---------- merge ----------

    private static List<String> merge(SystemSettings s, SystemSettingsDto p) {
        List<String> changed = new ArrayList<>();
        if (p.thresholds() != null) {
            SystemSettingsDto.ThresholdsDto t = p.thresholds();
            Thresholds target = s.getThresholds();
            mergeBand(target.getTemperatureC(), t.temperatureC(), "thresholds.temperatureC", changed);
            mergeBand(target.getOilLevelPct(), t.oilLevelPct(), "thresholds.oilLevelPct", changed);
            mergeBand(target.getLoadPct(), t.loadPct(), "thresholds.loadPct", changed);
            mergeBand(target.getVoltageDeviationPct(), t.voltageDeviationPct(), "thresholds.voltageDeviationPct",
                    changed);
            mergeBand(target.getCurrentPctOfRated(), t.currentPctOfRated(), "thresholds.currentPctOfRated", changed);
        }
        if (p.sensorTimeoutSeconds() != null) {
            s.setSensorTimeoutSeconds(p.sensorTimeoutSeconds());
            changed.add("sensorTimeoutSeconds");
        }
        if (p.recoveryReadings() != null) {
            s.setRecoveryReadings(p.recoveryReadings());
            changed.add("recoveryReadings");
        }
        if (p.healthWeights() != null) {
            SystemSettingsDto.HealthWeightsDto w = p.healthWeights();
            HealthWeights target = s.getHealthWeights();
            if (w.temperature() != null) {
                target.setTemperature(w.temperature());
            }
            if (w.oilLevel() != null) {
                target.setOilLevel(w.oilLevel());
            }
            if (w.load() != null) {
                target.setLoad(w.load());
            }
            if (w.electrical() != null) {
                target.setElectrical(w.electrical());
            }
            if (w.faultHistory() != null) {
                target.setFaultHistory(w.faultHistory());
            }
            changed.add("healthWeights");
        }
        if (p.notifications() != null) {
            SystemSettingsDto.NotificationPrefsDto n = p.notifications();
            NotificationPrefs target = s.getNotifications();
            if (n.criticalAlertRoles() != null) {
                target.setCriticalAlertRoles(new ArrayList<>(n.criticalAlertRoles()));
            }
            if (n.offlineRoles() != null) {
                target.setOfflineRoles(new ArrayList<>(n.offlineRoles()));
            }
            if (n.resolvedRoles() != null) {
                target.setResolvedRoles(new ArrayList<>(n.resolvedRoles()));
            }
            if (n.upcomingInspectionDays() != null) {
                target.setUpcomingInspectionDays(n.upcomingInspectionDays());
            }
            changed.add("notifications");
        }
        if (p.locations() != null) {
            List<String> trimmed = new ArrayList<>();
            for (String l : p.locations()) {
                trimmed.add(l == null ? null : l.trim());
            }
            s.setLocations(trimmed);
            changed.add("locations");
        }
        if (p.simulation() != null) {
            SystemSettingsDto.SimulationDto sim = p.simulation();
            SimulationConfig target = s.getSimulation();
            if (sim.enabled() != null) {
                target.setEnabled(sim.enabled());
            }
            if (sim.intervalSeconds() != null) {
                target.setIntervalSeconds(sim.intervalSeconds());
            }
            if (sim.noiseFactor() != null) {
                target.setNoiseFactor(sim.noiseFactor());
            }
            changed.add("simulation");
        }
        return changed;
    }

    private static void mergeBand(ThresholdBand target, SystemSettingsDto.ThresholdBandDto patch, String name,
                                  List<String> changed) {
        if (patch == null) {
            return;
        }
        if (patch.good() != null) {
            target.setGood(patch.good());
        }
        if (patch.warn() != null) {
            target.setWarn(patch.warn());
        }
        if (patch.critical() != null) {
            target.setCritical(patch.critical());
        }
        changed.add(name);
    }

    // ---------- validation ----------

    static List<ApiError.FieldError> validate(SystemSettings s) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        Thresholds t = s.getThresholds();
        higherIsWorse(t.getTemperatureC(), "thresholds.temperatureC", errors);
        lowerIsWorse(t.getOilLevelPct(), "thresholds.oilLevelPct", errors);
        higherIsWorse(t.getLoadPct(), "thresholds.loadPct", errors);
        higherIsWorse(t.getVoltageDeviationPct(), "thresholds.voltageDeviationPct", errors);
        higherIsWorse(t.getCurrentPctOfRated(), "thresholds.currentPctOfRated", errors);
        if (t.getVoltageDeviationPct().getGood() < 0) {
            errors.add(new ApiError.FieldError("thresholds.voltageDeviationPct", "values must not be negative"));
        }

        if (s.getSensorTimeoutSeconds() < 10) {
            errors.add(new ApiError.FieldError("sensorTimeoutSeconds", "must be at least 10"));
        }
        if (s.getRecoveryReadings() < 1 || s.getRecoveryReadings() > 20) {
            errors.add(new ApiError.FieldError("recoveryReadings", "must be between 1 and 20"));
        }

        HealthWeights w = s.getHealthWeights();
        double[] weights = {w.getTemperature(), w.getOilLevel(), w.getLoad(), w.getElectrical(), w.getFaultHistory()};
        double sum = 0;
        boolean negative = false;
        for (double v : weights) {
            sum += v;
            negative |= v < 0 || Double.isNaN(v);
        }
        if (negative) {
            errors.add(new ApiError.FieldError("healthWeights", "weights must not be negative"));
        }
        if (Double.isNaN(sum) || Math.abs(sum - 100) > WEIGHT_TOLERANCE) {
            errors.add(new ApiError.FieldError("healthWeights", "weights must sum to 100 (currently " + sum + ")"));
        }

        NotificationPrefs n = s.getNotifications();
        if (n.getUpcomingInspectionDays() < 0 || n.getUpcomingInspectionDays() > 365) {
            errors.add(new ApiError.FieldError("notifications.upcomingInspectionDays", "must be between 0 and 365"));
        }
        if (n.getCriticalAlertRoles().contains(null) || n.getOfflineRoles().contains(null)
                || n.getResolvedRoles().contains(null)) {
            errors.add(new ApiError.FieldError("notifications", "roles must not contain null"));
        }

        List<String> locations = s.getLocations();
        if (locations.isEmpty()) {
            errors.add(new ApiError.FieldError("locations", "must contain at least one location"));
        }
        Set<String> seen = new HashSet<>();
        for (String l : locations) {
            if (l == null || l.isBlank()) {
                errors.add(new ApiError.FieldError("locations", "locations must not be blank"));
                break;
            }
            if (!seen.add(l.toLowerCase(Locale.ROOT))) {
                errors.add(new ApiError.FieldError("locations", "duplicate location: " + l));
                break;
            }
        }

        SimulationConfig sim = s.getSimulation();
        if (sim.getIntervalSeconds() < 2 || sim.getIntervalSeconds() > 3600) {
            errors.add(new ApiError.FieldError("simulation.intervalSeconds", "must be between 2 and 3600"));
        }
        if (Double.isNaN(sim.getNoiseFactor()) || sim.getNoiseFactor() < 0 || sim.getNoiseFactor() > 10) {
            errors.add(new ApiError.FieldError("simulation.noiseFactor", "must be between 0 and 10"));
        }
        return errors;
    }

    private static void higherIsWorse(ThresholdBand b, String field, List<ApiError.FieldError> errors) {
        if (!(b.getGood() < b.getWarn() && b.getWarn() < b.getCritical())) {
            errors.add(new ApiError.FieldError(field, "must satisfy good < warn < critical"));
        }
    }

    private static void lowerIsWorse(ThresholdBand b, String field, List<ApiError.FieldError> errors) {
        if (!(b.getGood() > b.getWarn() && b.getWarn() > b.getCritical())) {
            errors.add(new ApiError.FieldError(field, "must satisfy good > warn > critical (lower is worse)"));
        }
    }
}
