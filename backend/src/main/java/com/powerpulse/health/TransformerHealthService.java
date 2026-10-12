package com.powerpulse.health;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.HealthWeights;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.settings.ThresholdBand;
import com.powerpulse.settings.Thresholds;
import com.powerpulse.transformer.HealthFactor;
import com.powerpulse.transformer.RatedValues;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Pure health scoring and status derivation (docs/development-plan.md §Health score). The score is a transparent
 * heuristic for prioritization; it is not a statistically validated probability of failure.
 */
@Service
public class TransformerHealthService {

    public static final int CRITICAL_SCORE = 40;
    public static final int WARNING_SCORE = 70;

    public HealthAssessment assess(Transformer t, ReadingSnapshot latest, List<Alert> activeAlerts,
                                   long resolvedIncidentsLast30Days, SystemSettings s, Instant now) {
        List<Alert> alerts = activeAlerts == null ? List.of() : activeAlerts.stream().filter(Alert::isActive).toList();
        Thresholds th = s.getThresholds();
        HealthWeights w = s.getHealthWeights();
        List<HealthFactor> factors = new ArrayList<>();

        // temperature
        Double temp = valid(latest == null ? null : latest.getTemperatureC());
        ThresholdBand tb = th.getTemperatureC();
        double pTemp = temp == null ? 0 : w.getTemperature() * ramp(temp, tb.getGood(), tb.getCritical());
        factors.add(factor("temperature", pTemp, w.getTemperature(), temp == null ? "No valid temperature reading"
                : fmt("Temperature %.1f °C (penalty ramps from %.0f °C to %.0f °C)", temp, tb.getGood(),
                tb.getCritical())));

        // oil level (lower is worse)
        Double oil = valid(latest == null ? null : latest.getOilLevelPct());
        ThresholdBand ob = th.getOilLevelPct();
        double pOil = oil == null ? 0 : w.getOilLevel() * rampLow(oil, ob.getGood(), ob.getCritical());
        factors.add(factor("oilLevel", pOil, w.getOilLevel(), oil == null ? "No valid oil level reading"
                : fmt("Oil level %.1f %% (penalty ramps from %.0f %% down to %.0f %%)", oil, ob.getGood(),
                ob.getCritical())));

        // load
        Double load = valid(latest == null ? null : latest.getLoadPct());
        ThresholdBand lb = th.getLoadPct();
        double pLoad = load == null ? 0 : w.getLoad() * ramp(load, lb.getGood(), lb.getCritical());
        factors.add(factor("load", pLoad, w.getLoad(), load == null ? "No valid load reading"
                : fmt("Load %.1f %% of rated (penalty ramps from %.0f %% to %.0f %%)", load, lb.getGood(),
                lb.getCritical())));

        // electrical: worst of voltage deviation and current % of rated
        Double volt = valid(latest == null ? null : latest.getVoltageV());
        Double curr = valid(latest == null ? null : latest.getCurrentA());
        ThresholdBand vb = th.getVoltageDeviationPct();
        ThresholdBand cb = th.getCurrentPctOfRated();
        double rampV = 0;
        double rampI = 0;
        List<String> parts = new ArrayList<>();
        if (volt != null && t.getSecondaryVoltageV() > 0) {
            double dev = RatedValues.voltageDeviationPct(volt, t.getSecondaryVoltageV());
            rampV = ramp(dev, vb.getGood(), vb.getCritical());
            parts.add(fmt("voltage deviation %.1f %%", dev));
        }
        if (curr != null && RatedValues.ratedCurrentA(t) > 0) {
            double pct = RatedValues.currentPctOfRated(curr, t);
            rampI = ramp(pct, cb.getGood(), cb.getCritical());
            parts.add(fmt("current %.1f %% of rated", pct));
        }
        double pElec = w.getElectrical() * Math.max(rampV, rampI);
        factors.add(factor("electrical", pElec, w.getElectrical(), parts.isEmpty() ? "No valid electrical reading"
                : capitalize(String.join(", ", parts))));

        // fault history
        int active = alerts.size();
        double pHist = Math.min(w.getFaultHistory(), 3.0 * active + 1.0 * resolvedIncidentsLast30Days);
        factors.add(factor("faultHistory", pHist, w.getFaultHistory(),
                active + " active alert" + (active == 1 ? "" : "s") + ", " + resolvedIncidentsLast30Days
                        + " incident" + (resolvedIncidentsLast30Days == 1 ? "" : "s") + " resolved in the last 30 days"));

        double total = pTemp + pOil + pLoad + pElec + pHist;
        int score = (int) Math.max(0, Math.min(100, Math.round(100 - total)));
        TransformerStatus status = deriveStatus(t, latest, alerts, score, s, now);
        return new HealthAssessment(score, factors, status, active);
    }

    /**
     * Status rules (separate from the score):
     * 1. no reading, reading older than the sensor timeout, or an open (unrecovered) STALE_READING alert → OFFLINE;
     * 2. active HIGH/CRITICAL alert or score &lt; 40 → CRITICAL; 3. any active alert or score &lt; 70 → WARNING;
     * 4. otherwise HEALTHY.
     */
    public TransformerStatus deriveStatus(Transformer t, ReadingSnapshot latest, List<Alert> activeAlerts, int score,
                                          SystemSettings s, Instant now) {
        Instant last = t.getLastReadingAt() != null ? t.getLastReadingAt()
                : latest == null ? null : latest.getRecordedAt();
        if (latest == null || last == null
                || Duration.between(last, now).getSeconds() > s.getSensorTimeoutSeconds()) {
            return TransformerStatus.OFFLINE;
        }
        boolean staleOpen = activeAlerts.stream().anyMatch(a -> a.getFaultType() == FaultType.STALE_READING
                && !a.isRecovered() && a.getConsecutiveNormalCount() == 0);
        if (staleOpen) {
            return TransformerStatus.OFFLINE;
        }
        boolean severe = activeAlerts.stream().anyMatch(a -> a.getSeverity() == Severity.HIGH
                || a.getSeverity() == Severity.CRITICAL);
        if (severe || score < CRITICAL_SCORE) {
            return TransformerStatus.CRITICAL;
        }
        if (!activeAlerts.isEmpty() || score < WARNING_SCORE) {
            return TransformerStatus.WARNING;
        }
        return TransformerStatus.HEALTHY;
    }

    /** Capacity-weighted mean health of non-OFFLINE transformers, rounded; null when there are none. */
    public Integer networkHealth(List<Transformer> transformers) {
        double weighted = 0;
        double capacity = 0;
        for (Transformer t : transformers) {
            if (t.getStatus() == TransformerStatus.OFFLINE || t.getRatedCapacityKva() <= 0) {
                continue;
            }
            weighted += t.getHealthScore() * t.getRatedCapacityKva();
            capacity += t.getRatedCapacityKva();
        }
        return capacity == 0 ? null : (int) Math.round(weighted / capacity);
    }

    /** clamp((v − good) / (critical − good), 0, 1); works for both directions when good/critical are mirrored. */
    static double ramp(double v, double good, double critical) {
        if (critical == good) {
            return v >= critical ? 1 : 0;
        }
        return Math.max(0, Math.min(1, (v - good) / (critical - good)));
    }

    /** Lower-is-worse ramp (good &gt; critical). */
    static double rampLow(double v, double good, double critical) {
        return ramp(-v, -good, -critical);
    }

    private static Double valid(Double v) {
        return v == null || Double.isNaN(v) || Double.isInfinite(v) ? null : v;
    }

    private static HealthFactor factor(String name, double penalty, double max, String detail) {
        HealthFactor f = new HealthFactor();
        f.setFactor(name);
        f.setPenalty(Math.round(penalty * 10.0) / 10.0);
        f.setMaxPenalty(max);
        f.setDetail(detail);
        return f;
    }

    private static String fmt(String pattern, Object... args) {
        return String.format(Locale.ROOT, pattern, args);
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
