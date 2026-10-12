package com.powerpulse.simulation;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.fault.FaultDetectionService;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.RatedValues;
import com.powerpulse.transformer.Transformer;
import java.util.Random;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

class SimulationEngineTest {

    private final SimulationEngine engine = new SimulationEngine();
    private final Transformer t = transformer("t1", "PP-TX-001");
    private final SystemSettings settings = new SystemSettings();

    private ReadingInput gen(Scenario s, int step, ReadingSnapshot prev) {
        return engine.next(t, prev, s, step, new Random(7), 1.0, NOW).input();
    }

    @Test
    void nominalProfileIsDeterministicPerCodeAndWithinRanges() {
        SimulationEngine.Profile a = SimulationEngine.nominal(t);
        assertThat(SimulationEngine.nominal(transformer("x", "PP-TX-001"))).isEqualTo(a);
        assertThat(SimulationEngine.nominal(transformer("x", "PP-TX-002"))).isNotEqualTo(a);
        assertThat(a.temperatureC()).isBetween(50.0, 70.0);
        assertThat(a.oilLevelPct()).isBetween(85.0, 98.0);
        assertThat(a.loadPct()).isBetween(40.0, 75.0);
        assertThat(a.powerFactor()).isBetween(0.88, 0.97);
    }

    @Test
    void baselineWalkStaysBoundedAndProducesNoFaults() {
        Random rng = new Random(1);
        ReadingSnapshot prev = null;
        FaultDetectionService detector = new FaultDetectionService();
        for (int i = 0; i < 500; i++) {
            ReadingInput in = engine.baseline(t, prev, rng, 1.0, NOW);
            assertThat(in.temperatureC()).isBetween(50.0, 70.0);
            assertThat(in.oilLevelPct()).isBetween(85.0, 98.0);
            assertThat(in.loadPct()).isBetween(40.0, 75.0);
            assertThat(in.voltageV()).isBetween(415 * 0.985 - 0.1, 415 * 1.015 + 0.1);
            assertThat(in.powerFactor()).isBetween(0.88, 0.97);
            // current is derived from load: I = load% × I_rated
            assertThat(in.currentA()).isCloseTo(in.loadPct() / 100 * RatedValues.ratedCurrentA(t), Offset.offset(1.0));
            prev = SimulationEngine.toSnapshot(in);
            assertThat(detector.evaluate(t, prev, settings).findings()).isEmpty();
        }
    }

    @Test
    void criticalOverheatingReachesCriticalThresholdImmediately() {
        for (int step = 0; step < 5; step++) {
            ReadingInput in = gen(Scenario.CRITICAL_OVERHEATING, step, null);
            assertThat(in.temperatureC()).isBetween(110.0, 115.0)
                    .isGreaterThanOrEqualTo(settings.getThresholds().getTemperatureC().getCritical());
        }
        ReadingSnapshot r = SimulationEngine.toSnapshot(gen(Scenario.CRITICAL_OVERHEATING, 0, null));
        assertThat(new FaultDetectionService().evaluate(t, r, settings).finding(FaultType.OVERHEATING).orElseThrow()
                .severity()).isEqualTo(com.powerpulse.common.domain.Severity.CRITICAL);
    }

    @Test
    void risingTemperatureClimbsFourDegreesPerTickUpTo95() {
        double nominal = SimulationEngine.nominal(t).temperatureC();
        assertThat(gen(Scenario.RISING_TEMPERATURE, 0, null).temperatureC()).isCloseTo(nominal + 4, Offset.offset(0.06));
        assertThat(gen(Scenario.RISING_TEMPERATURE, 2, null).temperatureC()).isCloseTo(nominal + 12, Offset.offset(0.06));
        assertThat(gen(Scenario.RISING_TEMPERATURE, 50, null).temperatureC()).isEqualTo(95.0);
    }

    @Test
    void lowOilDropsFivePercentPerTickTo35() {
        double nominal = SimulationEngine.nominal(t).oilLevelPct();
        assertThat(gen(Scenario.LOW_OIL, 0, null).oilLevelPct()).isCloseTo(nominal - 5, Offset.offset(0.06));
        assertThat(gen(Scenario.LOW_OIL, 50, null).oilLevelPct()).isEqualTo(35.0);
    }

    @Test
    void overloadingClimbsTo118AndCurrentFollows() {
        ReadingInput in = gen(Scenario.OVERLOADING, 50, null);
        assertThat(in.loadPct()).isEqualTo(118.0);
        assertThat(in.currentA()).isCloseTo(1.18 * RatedValues.ratedCurrentA(t), Offset.offset(0.1));
    }

    @Test
    void returnToNormalRampsOverThreeTicksThenCompletes() {
        ReadingSnapshot hot = SimulationEngine.toSnapshot(gen(Scenario.CRITICAL_OVERHEATING, 0, null));
        double nominal = SimulationEngine.nominal(t).temperatureC();
        SimulationEngine.Generated g0 = engine.next(t, hot, Scenario.RETURN_TO_NORMAL, 0, new Random(1), 1, NOW);
        assertThat(g0.scenarioComplete()).isFalse();
        assertThat(g0.input().temperatureC()).isBetween(nominal, hot.getTemperatureC());
        SimulationEngine.Generated g1 = engine.next(t, SimulationEngine.toSnapshot(g0.input()),
                Scenario.RETURN_TO_NORMAL, 1, new Random(1), 1, NOW);
        assertThat(g1.scenarioComplete()).isFalse();
        SimulationEngine.Generated g2 = engine.next(t, SimulationEngine.toSnapshot(g1.input()),
                Scenario.RETURN_TO_NORMAL, 2, new Random(1), 1, NOW);
        assertThat(g2.scenarioComplete()).isTrue();
        assertThat(g2.input().temperatureC()).isCloseTo(nominal, Offset.offset(0.06));
    }

    @Test
    void offlineScenarioGeneratesNothing() {
        assertThatThrownBy(() -> gen(Scenario.OFFLINE, 0, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void scenarioSlugs() {
        assertThat(Scenario.slugs()).containsExactly("healthy", "rising-temperature", "low-oil", "overloading",
                "critical-overheating", "offline", "return-to-normal", "manual");
        assertThat(Scenario.fromSlug("nope")).isEmpty();
    }
}
