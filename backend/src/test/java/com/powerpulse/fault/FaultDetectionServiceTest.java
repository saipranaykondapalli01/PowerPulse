package com.powerpulse.fault;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.normal;
import static com.powerpulse.TestData.reading;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.Transformer;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FaultDetectionServiceTest {

    private final FaultDetectionService service = new FaultDetectionService();
    private final SystemSettings settings = new SystemSettings();
    private final Transformer t = transformer("t1", "PP-TX-001");
    /** I_rated for 500 kVA at 415 V. */
    private static final double I_RATED = 500_000 / (Math.sqrt(3) * 415);

    @Test
    void normalReadingHasNoFindingsAndEvaluatesEveryRule() {
        FaultEvaluation e = service.evaluate(t, normal(), settings);
        assertThat(e.findings()).isEmpty();
        assertThat(e.evaluated()).containsExactlyInAnyOrder(FaultType.values());
    }

    // temperature: warn 85, critical 105, mid 95
    @ParameterizedTest
    @CsvSource({"84.99,", "85,MEDIUM", "94.99,MEDIUM", "95,HIGH", "104.99,HIGH", "105,CRITICAL", "150,CRITICAL"})
    void overheatingBands(double temp, Severity expected) {
        ReadingSnapshot r = normal();
        r.setTemperatureC(temp);
        Optional<FaultFinding> f = service.evaluate(t, r, settings).finding(FaultType.OVERHEATING);
        assertThat(f.map(FaultFinding::severity).orElse(null)).isEqualTo(expected);
        f.ifPresent(x -> {
            assertThat(x.unit()).isEqualTo("°C");
            assertThat(x.measuredValue()).isEqualTo(temp);
            assertThat(x.threshold()).isEqualTo(expected == Severity.CRITICAL ? 105.0 : 85.0);
        });
    }

    // oil (lower is worse): warn 60, critical 40, mid 50
    @ParameterizedTest
    @CsvSource({"60.01,", "60,MEDIUM", "50.01,MEDIUM", "50,HIGH", "40.01,HIGH", "40,CRITICAL", "0,CRITICAL"})
    void lowOilBandsAreMirrored(double oil, Severity expected) {
        ReadingSnapshot r = normal();
        r.setOilLevelPct(oil);
        Optional<FaultFinding> f = service.evaluate(t, r, settings).finding(FaultType.LOW_OIL_LEVEL);
        assertThat(f.map(FaultFinding::severity).orElse(null)).isEqualTo(expected);
        f.ifPresent(x -> assertThat(x.threshold()).isEqualTo(expected == Severity.CRITICAL ? 40.0 : 60.0));
    }

    // load: warn 90, critical 110, mid 100
    @ParameterizedTest
    @CsvSource({"89.9,", "90,MEDIUM", "100,HIGH", "110,CRITICAL"})
    void overloadingBands(double load, Severity expected) {
        ReadingSnapshot r = normal();
        r.setLoadPct(load);
        assertThat(service.evaluate(t, r, settings).finding(FaultType.OVERLOADING).map(FaultFinding::severity)
                .orElse(null)).isEqualTo(expected);
    }

    // voltage deviation: warn 5 %, critical 10 %, mid 7.5 % of 415 V
    @ParameterizedTest
    @CsvSource({"415,", "435.5,", "436,MEDIUM", "446,MEDIUM", "447,HIGH", "456,HIGH", "457,CRITICAL",
            "394,MEDIUM", "373,CRITICAL"})
    void abnormalVoltageUsesDeviationFromRatedSecondary(double volt, Severity expected) {
        ReadingSnapshot r = normal();
        r.setVoltageV(volt);
        Optional<FaultFinding> f = service.evaluate(t, r, settings).finding(FaultType.ABNORMAL_VOLTAGE);
        assertThat(f.map(FaultFinding::severity).orElse(null)).isEqualTo(expected);
        f.ifPresent(x -> {
            assertThat(x.unit()).isEqualTo("V");
            assertThat(x.measuredValue()).isEqualTo(volt);
        });
    }

    @Test
    void abnormalVoltageThresholdIsTheVoltBoundOnTheSideOfTheDeviation() {
        ReadingSnapshot high = normal();
        high.setVoltageV(440.0); // +6 % → MEDIUM, bound = 415 × 1.05
        assertThat(service.evaluate(t, high, settings).finding(FaultType.ABNORMAL_VOLTAGE).orElseThrow().threshold())
                .isEqualTo(435.75);
        ReadingSnapshot low = normal();
        low.setVoltageV(370.0); // −10.8 % → CRITICAL, bound = 415 × 0.90
        FaultFinding f = service.evaluate(t, low, settings).finding(FaultType.ABNORMAL_VOLTAGE).orElseThrow();
        assertThat(f.severity()).isEqualTo(Severity.CRITICAL);
        assertThat(f.threshold()).isEqualTo(373.5);
    }

    @Test
    void abnormalCurrentUsesPercentOfRatedCurrent() {
        // warn 95 %, critical 115 %, mid 105 %
        assertThat(currentSeverity(I_RATED * 0.94)).isNull();
        assertThat(currentSeverity(I_RATED * 0.951)).isEqualTo(Severity.MEDIUM);
        assertThat(currentSeverity(I_RATED * 1.06)).isEqualTo(Severity.HIGH);
        assertThat(currentSeverity(I_RATED * 1.16)).isEqualTo(Severity.CRITICAL);

        ReadingSnapshot r = normal();
        r.setCurrentA(I_RATED * 1.2);
        FaultFinding f = service.evaluate(t, r, settings).finding(FaultType.ABNORMAL_CURRENT).orElseThrow();
        assertThat(f.unit()).isEqualTo("A");
        assertThat(f.measuredValue()).isEqualTo(I_RATED * 1.2);
        assertThat(f.threshold()).isCloseTo(I_RATED * 1.15, org.assertj.core.data.Offset.offset(0.01));
    }

    private Severity currentSeverity(double amps) {
        ReadingSnapshot r = normal();
        r.setCurrentA(amps);
        return service.evaluate(t, r, settings).finding(FaultType.ABNORMAL_CURRENT).map(FaultFinding::severity)
                .orElse(null);
    }

    @Test
    void thresholdsComeFromSettings() {
        settings.getThresholds().getTemperatureC().setWarn(70);
        settings.getThresholds().getTemperatureC().setCritical(80);
        ReadingSnapshot r = normal();
        r.setTemperatureC(80.0);
        assertThat(service.evaluate(t, r, settings).finding(FaultType.OVERHEATING).orElseThrow().severity())
                .isEqualTo(Severity.CRITICAL);
    }

    @Test
    void impossibleTemperatureIsSensorFailureAndTemperatureRuleIsSkipped() {
        ReadingSnapshot r = normal();
        r.setTemperatureC(250.0);
        FaultEvaluation e = service.evaluate(t, r, settings);
        FaultFinding sf = e.finding(FaultType.SENSOR_FAILURE).orElseThrow();
        assertThat(sf.severity()).isEqualTo(Severity.HIGH);
        assertThat(sf.description()).contains("temperatureC");
        assertThat(e.finding(FaultType.OVERHEATING)).isEmpty();
        assertThat(e.wasEvaluated(FaultType.OVERHEATING)).isFalse();
        // other metrics are still evaluated
        assertThat(e.wasEvaluated(FaultType.LOW_OIL_LEVEL)).isTrue();
        assertThat(e.wasEvaluated(FaultType.OVERLOADING)).isTrue();
    }

    @Test
    void missingAndOutOfRangeValuesAreSensorFailures() {
        assertThat(sensorFailure(reading(null, 90.0, 415.0, 300.0, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(-41.0, 90.0, 415.0, 300.0, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, 101.0, 415.0, 300.0, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, -1.0, 415.0, 300.0, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, 90.0, -1.0, 300.0, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, 90.0, 831.0, 300.0, 50.0, 0.95))).isTrue(); // > 2× rated
        assertThat(sensorFailure(reading(60.0, 90.0, 415.0, -0.1, 50.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, 90.0, 415.0, 300.0, 301.0, 0.95))).isTrue();
        assertThat(sensorFailure(reading(60.0, 90.0, 415.0, 300.0, 50.0, 1.2))).isTrue();
        assertThat(sensorFailure(reading(Double.NaN, 90.0, 415.0, 300.0, 50.0, 0.95))).isTrue();
        // boundaries are physically possible
        assertThat(sensorFailure(reading(-40.0, 100.0, 830.0, 0.0, 300.0, 1.0))).isFalse();
        // power factor is optional
        assertThat(sensorFailure(reading(60.0, 90.0, 415.0, 300.0, 50.0, null))).isFalse();
    }

    private boolean sensorFailure(ReadingSnapshot r) {
        return service.evaluate(t, r, settings).finding(FaultType.SENSOR_FAILURE).isPresent();
    }

    @Test
    void invalidVoltageSkipsVoltageRuleButStillEvaluatesCurrent() {
        ReadingSnapshot r = reading(60.0, 90.0, null, I_RATED * 1.2, 50.0, 0.95);
        FaultEvaluation e = service.evaluate(t, r, settings);
        assertThat(e.wasEvaluated(FaultType.ABNORMAL_VOLTAGE)).isFalse();
        assertThat(e.finding(FaultType.ABNORMAL_CURRENT)).isPresent();
        assertThat(e.finding(FaultType.SENSOR_FAILURE)).isPresent();
    }

    @Test
    void staleWhenLastReadingOlderThanTimeout() {
        t.setLastReadingAt(NOW.minusSeconds(121));
        FaultFinding f = service.evaluateStale(t, settings, NOW).orElseThrow();
        assertThat(f.faultType()).isEqualTo(FaultType.STALE_READING);
        assertThat(f.severity()).isEqualTo(Severity.HIGH);
        assertThat(f.unit()).isEqualTo("s");
        assertThat(f.measuredValue()).isEqualTo(121.0);
        assertThat(f.threshold()).isEqualTo(120.0);

        t.setLastReadingAt(NOW.minusSeconds(120));
        assertThat(service.evaluateStale(t, settings, NOW)).isEmpty();
    }

    @Test
    void neverReportedTransformerIsStaleOnlyAfterTimeoutSinceCreation() {
        t.setLastReadingAt(null);
        t.setCreatedAt(NOW.minusSeconds(60));
        assertThat(service.evaluateStale(t, settings, NOW)).isEmpty();
        t.setCreatedAt(NOW.minusSeconds(600));
        assertThat(service.evaluateStale(t, settings, NOW)).isPresent();
    }
}
