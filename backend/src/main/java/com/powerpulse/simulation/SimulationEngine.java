package com.powerpulse.simulation;

import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.transformer.RatedValues;
import com.powerpulse.transformer.Transformer;
import java.time.Instant;
import java.util.Random;
import org.springframework.stereotype.Component;

/**
 * Generates SIMULATED readings (not real IoT telemetry). Baseline: a bounded mean-reverting random walk around a
 * per-transformer nominal profile seeded deterministically from the transformer code. Scenarios are deterministic
 * step scripts that override the walk (docs/development-plan.md §Simulator).
 */
@Component
public class SimulationEngine {

    // Baseline ranges
    static final double TEMP_MIN = 50;
    static final double TEMP_MAX = 70;
    static final double OIL_MIN = 85;
    static final double OIL_MAX = 98;
    static final double LOAD_MIN = 40;
    static final double LOAD_MAX = 75;
    static final double VOLT_BAND = 0.015;
    static final double PF_MIN = 0.88;
    static final double PF_MAX = 0.97;
    static final double REVERSION = 0.3;

    // Scenario targets
    static final double RISING_TEMP_STEP = 4;
    static final double RISING_TEMP_CAP = 95;
    static final double LOW_OIL_STEP = 5;
    static final double LOW_OIL_FLOOR = 35;
    static final double OVERLOAD_STEP = 8;
    static final double OVERLOAD_CAP = 118;
    static final double CRITICAL_TEMP_MIN = 110;
    static final double CRITICAL_TEMP_SPAN = 5;
    static final int RETURN_TICKS = 3;

    /** Nominal operating point of one transformer. */
    public record Profile(double temperatureC, double oilLevelPct, double loadPct, double voltageV,
                          double powerFactor) {
    }

    /** One generated reading and whether the active scenario finished with it (return-to-normal). */
    public record Generated(ReadingInput input, boolean scenarioComplete) {
    }

    public static Profile nominal(Transformer t) {
        Random r = new Random(t.getCode() == null ? 0 : t.getCode().hashCode());
        double temp = 52 + r.nextDouble() * 14;
        double oil = 88 + r.nextDouble() * 8;
        double load = 45 + r.nextDouble() * 25;
        double vFactor = 1 + (r.nextDouble() * 2 - 1) * 0.008;
        double pf = 0.89 + r.nextDouble() * 0.07;
        return new Profile(temp, oil, load, t.getSecondaryVoltageV() * vFactor, pf);
    }

    /**
     * @param previous last reading of the transformer (used as the walk's current position); may be null
     * @param scenario active scenario or null for baseline behavior; OFFLINE must be handled by the caller (skip)
     */
    public Generated next(Transformer t, ReadingSnapshot previous, Scenario scenario, int step, Random rng,
                          double noiseFactor, Instant at) {
        Profile n = nominal(t);
        double vr = t.getSecondaryVoltageV();
        double temp = walk(prev(previous == null ? null : previous.getTemperatureC(), n.temperatureC()),
                n.temperatureC(), 0.8, TEMP_MIN, TEMP_MAX, rng, noiseFactor);
        double oil = walk(prev(previous == null ? null : previous.getOilLevelPct(), n.oilLevelPct()),
                n.oilLevelPct(), 0.3, OIL_MIN, OIL_MAX, rng, noiseFactor);
        double load = walk(prev(previous == null ? null : previous.getLoadPct(), n.loadPct()),
                n.loadPct(), 2.0, LOAD_MIN, LOAD_MAX, rng, noiseFactor);
        double volt = walk(prev(previous == null ? null : previous.getVoltageV(), n.voltageV()),
                n.voltageV(), vr * 0.003, vr * (1 - VOLT_BAND), vr * (1 + VOLT_BAND), rng, noiseFactor);
        double pf = walk(prev(previous == null ? null : previous.getPowerFactor(), n.powerFactor()),
                n.powerFactor(), 0.005, PF_MIN, PF_MAX, rng, noiseFactor);
        boolean complete = false;

        if (scenario != null) {
            int k = step + 1;
            switch (scenario) {
                case HEALTHY -> {
                    temp = n.temperatureC();
                    oil = n.oilLevelPct();
                    load = n.loadPct();
                    volt = n.voltageV();
                    pf = n.powerFactor();
                }
                case RISING_TEMPERATURE -> temp = Math.min(RISING_TEMP_CAP, n.temperatureC() + RISING_TEMP_STEP * k);
                case LOW_OIL -> oil = Math.max(LOW_OIL_FLOOR, n.oilLevelPct() - LOW_OIL_STEP * k);
                case OVERLOADING -> load = Math.min(OVERLOAD_CAP, n.loadPct() + OVERLOAD_STEP * k);
                case CRITICAL_OVERHEATING -> temp = CRITICAL_TEMP_MIN + rng.nextDouble() * CRITICAL_TEMP_SPAN;
                case RETURN_TO_NORMAL -> {
                    double f = Math.min(1.0, (double) k / RETURN_TICKS);
                    temp = toward(previous == null ? null : previous.getTemperatureC(), n.temperatureC(), f);
                    oil = toward(previous == null ? null : previous.getOilLevelPct(), n.oilLevelPct(), f);
                    load = toward(previous == null ? null : previous.getLoadPct(), n.loadPct(), f);
                    volt = toward(previous == null ? null : previous.getVoltageV(), n.voltageV(), f);
                    pf = toward(previous == null ? null : previous.getPowerFactor(), n.powerFactor(), f);
                    complete = k >= RETURN_TICKS;
                }
                case OFFLINE, MANUAL -> {
                    // The caller skips offline and manually-read transformers; generating a reading here would be a bug.
                    throw new IllegalArgumentException("offline scenario produces no reading");
                }
            }
        }
        double current = load / 100.0 * RatedValues.ratedCurrentA(t);
        ReadingInput input = new ReadingInput(t.getId(), null, round(temp, 1), round(oil, 1), round(volt, 1),
                round(current, 1), round(load, 1), round(pf, 3), at);
        return new Generated(input, complete);
    }

    /** Baseline-only reading (used for the dev backfill). */
    public ReadingInput baseline(Transformer t, ReadingSnapshot previous, Random rng, double noiseFactor, Instant at) {
        return next(t, previous, null, 0, rng, noiseFactor, at).input();
    }

    public static ReadingSnapshot toSnapshot(ReadingInput in) {
        ReadingSnapshot s = new ReadingSnapshot();
        s.setTemperatureC(in.temperatureC());
        s.setOilLevelPct(in.oilLevelPct());
        s.setVoltageV(in.voltageV());
        s.setCurrentA(in.currentA());
        s.setLoadPct(in.loadPct());
        s.setPowerFactor(in.powerFactor());
        s.setRecordedAt(in.recordedAt());
        s.setSource(ReadingSource.SIMULATED);
        return s;
    }

    private static double prev(Double previous, double nominal) {
        return previous == null || Double.isNaN(previous) ? nominal : previous;
    }

    private static double walk(double x, double nominal, double sigma, double min, double max, Random rng,
                               double noise) {
        double next = x + REVERSION * (nominal - x) + noise * sigma * rng.nextGaussian();
        return Math.max(min, Math.min(max, next));
    }

    private static double toward(Double from, double nominal, double fraction) {
        double start = from == null || Double.isNaN(from) ? nominal : from;
        return start + (nominal - start) * fraction;
    }

    private static double round(double v, int digits) {
        double f = Math.pow(10, digits);
        return Math.round(v * f) / f;
    }
}
