package com.powerpulse.fault;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.settings.ThresholdBand;
import com.powerpulse.settings.Thresholds;
import com.powerpulse.transformer.RatedValues;
import com.powerpulse.transformer.Transformer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Pure rule evaluation (no side effects). Thresholds come from {@link SystemSettings#getThresholds()} and are
 * configurable demo defaults, not universal safety limits. See docs/development-plan.md §Fault detection rules.
 */
@Service
public class FaultDetectionService {

    static final double TEMP_MIN = -40;
    static final double TEMP_MAX = 200;
    static final double LOAD_MAX = 300;

    /**
     * Severity for a "higher is worse" value: {@code < warn} none, {@code [warn, mid)} MEDIUM, {@code [mid, critical)}
     * HIGH, {@code >= critical} CRITICAL, with {@code mid = (warn + critical) / 2}.
     */
    public static Severity bandHigher(double value, double warn, double critical) {
        if (value < warn) {
            return null;
        }
        double mid = (warn + critical) / 2.0;
        if (value < mid) {
            return Severity.MEDIUM;
        }
        if (value < critical) {
            return Severity.HIGH;
        }
        return Severity.CRITICAL;
    }

    /** Mirrored band for a "lower is worse" value ({@code warn > critical}). */
    public static Severity bandLower(double value, double warn, double critical) {
        return bandHigher(-value, -warn, -critical);
    }

    public FaultEvaluation evaluate(Transformer t, ReadingSnapshot r, SystemSettings s) {
        Thresholds th = s.getThresholds();
        List<FaultFinding> findings = new ArrayList<>();
        Set<FaultType> evaluated = EnumSet.of(FaultType.SENSOR_FAILURE, FaultType.STALE_READING);

        Double temp = r.getTemperatureC();
        Double oil = r.getOilLevelPct();
        Double volt = r.getVoltageV();
        Double curr = r.getCurrentA();
        Double load = r.getLoadPct();
        Double pf = r.getPowerFactor();

        List<String> invalid = new ArrayList<>();
        boolean tempOk = check(temp, v -> v >= TEMP_MIN && v <= TEMP_MAX, "temperatureC", invalid);
        boolean oilOk = check(oil, v -> v >= 0 && v <= 100, "oilLevelPct", invalid);
        double ratedV = t.getSecondaryVoltageV();
        boolean voltOk = check(volt, v -> v >= 0 && (ratedV <= 0 || v <= 2 * ratedV), "voltageV", invalid);
        boolean currOk = check(curr, v -> v >= 0, "currentA", invalid);
        boolean loadOk = check(load, v -> v >= 0 && v <= LOAD_MAX, "loadPct", invalid);
        if (pf != null && (Double.isNaN(pf) || pf < 0 || pf > 1)) {
            invalid.add("powerFactor");
        }

        if (!invalid.isEmpty()) {
            String first = invalid.get(0);
            findings.add(new FaultFinding(FaultType.SENSOR_FAILURE, Severity.HIGH, valueOf(first, r), null,
                    unitOf(first), "Sensor values missing or outside physical range: " + String.join(", ", invalid)
                    + ". Affected metrics are excluded from fault rules."));
        }

        if (tempOk) {
            evaluated.add(FaultType.OVERHEATING);
            ThresholdBand b = th.getTemperatureC();
            Severity sev = bandHigher(temp, b.getWarn(), b.getCritical());
            if (sev != null) {
                double bound = boundFor(sev, b);
                findings.add(new FaultFinding(FaultType.OVERHEATING, sev, temp, bound, "°C",
                        String.format(Locale.ROOT, "Temperature %.1f °C reached the configured %s threshold of %.1f °C",
                                temp, label(sev), bound)));
            }
        }
        if (oilOk) {
            evaluated.add(FaultType.LOW_OIL_LEVEL);
            ThresholdBand b = th.getOilLevelPct();
            Severity sev = bandLower(oil, b.getWarn(), b.getCritical());
            if (sev != null) {
                double bound = boundFor(sev, b);
                findings.add(new FaultFinding(FaultType.LOW_OIL_LEVEL, sev, oil, bound, "%",
                        String.format(Locale.ROOT, "Oil level %.1f %% fell to the configured %s threshold of %.1f %%",
                                oil, label(sev), bound)));
            }
        }
        if (loadOk) {
            evaluated.add(FaultType.OVERLOADING);
            ThresholdBand b = th.getLoadPct();
            Severity sev = bandHigher(load, b.getWarn(), b.getCritical());
            if (sev != null) {
                double bound = boundFor(sev, b);
                findings.add(new FaultFinding(FaultType.OVERLOADING, sev, load, bound, "%",
                        String.format(Locale.ROOT, "Load %.1f %% of rated capacity reached the configured %s threshold "
                                + "of %.1f %%", load, label(sev), bound)));
            }
        }
        if (voltOk && ratedV > 0) {
            evaluated.add(FaultType.ABNORMAL_VOLTAGE);
            ThresholdBand b = th.getVoltageDeviationPct();
            double dev = RatedValues.voltageDeviationPct(volt, ratedV);
            Severity sev = bandHigher(dev, b.getWarn(), b.getCritical());
            if (sev != null) {
                double pct = boundFor(sev, b);
                double sign = volt >= ratedV ? 1 : -1;
                double boundV = ratedV * (1 + sign * pct / 100.0);
                findings.add(new FaultFinding(FaultType.ABNORMAL_VOLTAGE, sev, volt, round2(boundV), "V",
                        String.format(Locale.ROOT, "Voltage %.1f V deviates %.1f %% from rated %.0f V (configured %s "
                                + "bound %.1f %%)", volt, dev, ratedV, label(sev), pct)));
            }
        }
        double ratedI = RatedValues.ratedCurrentA(t);
        if (currOk && ratedI > 0) {
            evaluated.add(FaultType.ABNORMAL_CURRENT);
            ThresholdBand b = th.getCurrentPctOfRated();
            double pctOfRated = curr / ratedI * 100.0;
            Severity sev = bandHigher(pctOfRated, b.getWarn(), b.getCritical());
            if (sev != null) {
                double pct = boundFor(sev, b);
                double boundA = ratedI * pct / 100.0;
                findings.add(new FaultFinding(FaultType.ABNORMAL_CURRENT, sev, curr, round2(boundA), "A",
                        String.format(Locale.ROOT, "Current %.1f A is %.1f %% of rated %.1f A (configured %s bound "
                                + "%.1f %%)", curr, pctOfRated, ratedI, label(sev), pct)));
            }
        }
        return new FaultEvaluation(findings, evaluated);
    }

    /**
     * STALE_READING check: the reference time is {@code lastReadingAt}, or {@code createdAt} for a transformer that
     * never reported. Fires when the age exceeds {@code sensorTimeoutSeconds}.
     */
    public Optional<FaultFinding> evaluateStale(Transformer t, SystemSettings s, Instant now) {
        Instant reference = t.getLastReadingAt() != null ? t.getLastReadingAt() : t.getCreatedAt();
        if (reference == null) {
            return Optional.empty();
        }
        long age = Duration.between(reference, now).getSeconds();
        int timeout = s.getSensorTimeoutSeconds();
        if (age <= timeout) {
            return Optional.empty();
        }
        String what = t.getLastReadingAt() == null ? "No reading received since registration" : "No reading received";
        return Optional.of(new FaultFinding(FaultType.STALE_READING, Severity.HIGH, (double) age, (double) timeout, "s",
                what + " for " + age + " s (configured sensor timeout " + timeout + " s)"));
    }

    private static double boundFor(Severity sev, ThresholdBand b) {
        return sev == Severity.CRITICAL ? b.getCritical() : b.getWarn();
    }

    private static String label(Severity sev) {
        return sev == Severity.CRITICAL ? "critical" : "warning";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private interface DoubleCheck {
        boolean ok(double v);
    }

    private static boolean check(Double v, DoubleCheck range, String name, List<String> invalid) {
        if (v == null || Double.isNaN(v) || Double.isInfinite(v) || !range.ok(v)) {
            invalid.add(name);
            return false;
        }
        return true;
    }

    private static Double valueOf(String metric, ReadingSnapshot r) {
        Double v = switch (metric) {
            case "temperatureC" -> r.getTemperatureC();
            case "oilLevelPct" -> r.getOilLevelPct();
            case "voltageV" -> r.getVoltageV();
            case "currentA" -> r.getCurrentA();
            case "loadPct" -> r.getLoadPct();
            default -> r.getPowerFactor();
        };
        return v == null || Double.isNaN(v) || Double.isInfinite(v) ? null : v;
    }

    private static String unitOf(String metric) {
        return switch (metric) {
            case "temperatureC" -> "°C";
            case "voltageV" -> "V";
            case "currentA" -> "A";
            case "powerFactor" -> "";
            default -> "%";
        };
    }
}
