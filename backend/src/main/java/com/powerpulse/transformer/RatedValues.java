package com.powerpulse.transformer;

/** Derived electrical quantities shared by fault detection, health scoring and the simulator. */
public final class RatedValues {

    private static final double SQRT3 = Math.sqrt(3);

    private RatedValues() {
    }

    /** I_rated = kVA·1000 / (√3 · V_secondary). Returns 0 when the nameplate values are not positive. */
    public static double ratedCurrentA(double ratedCapacityKva, double secondaryVoltageV) {
        if (ratedCapacityKva <= 0 || secondaryVoltageV <= 0) {
            return 0;
        }
        return ratedCapacityKva * 1000.0 / (SQRT3 * secondaryVoltageV);
    }

    public static double ratedCurrentA(Transformer t) {
        return ratedCurrentA(t.getRatedCapacityKva(), t.getSecondaryVoltageV());
    }

    /** |V − V_rated| / V_rated × 100. */
    public static double voltageDeviationPct(double voltageV, double secondaryVoltageV) {
        return Math.abs(voltageV - secondaryVoltageV) / secondaryVoltageV * 100.0;
    }

    /** I / I_rated × 100 (0 when I_rated is unknown). */
    public static double currentPctOfRated(double currentA, Transformer t) {
        double rated = ratedCurrentA(t);
        return rated <= 0 ? 0 : currentA / rated * 100.0;
    }
}
