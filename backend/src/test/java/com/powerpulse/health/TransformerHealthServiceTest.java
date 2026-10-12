package com.powerpulse.health;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.alert;
import static com.powerpulse.TestData.normal;
import static com.powerpulse.TestData.reading;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.HealthFactor;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStatus;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TransformerHealthServiceTest {

    private static final double I_RATED = 500_000 / (Math.sqrt(3) * 415);

    private final TransformerHealthService service = new TransformerHealthService();
    private SystemSettings settings;
    private Transformer t;

    @BeforeEach
    void setUp() {
        settings = new SystemSettings();
        t = transformer("t1", "PP-TX-001");
        t.setLastReadingAt(NOW.minusSeconds(5));
    }

    private Map<String, HealthFactor> byName(HealthAssessment a) {
        return a.factors().stream().collect(Collectors.toMap(HealthFactor::getFactor, f -> f));
    }

    @Test
    void nominalReadingScoresHundredAndHealthy() {
        HealthAssessment a = service.assess(t, normal(), List.of(), 0, settings, NOW);
        assertThat(a.score()).isEqualTo(100);
        assertThat(a.status()).isEqualTo(TransformerStatus.HEALTHY);
        assertThat(a.factors()).extracting(HealthFactor::getFactor)
                .containsExactly("temperature", "oilLevel", "load", "electrical", "faultHistory");
        assertThat(a.factors()).allSatisfy(f -> assertThat(f.getPenalty()).isZero());
        assertThat(byName(a).get("temperature").getMaxPenalty()).isEqualTo(30);
        assertThat(byName(a).get("oilLevel").getMaxPenalty()).isEqualTo(25);
        assertThat(byName(a).get("load").getMaxPenalty()).isEqualTo(20);
        assertThat(byName(a).get("electrical").getMaxPenalty()).isEqualTo(15);
        assertThat(byName(a).get("faultHistory").getMaxPenalty()).isEqualTo(10);
    }

    @Test
    void penaltiesUseLinearRampsAndHistory() {
        // temp 85 → half of 65..105; oil 60 → half of 80..40; load 90 → half of 70..110;
        // voltage +6 % → half of 2..10; current 95 % → half of 75..115.
        ReadingSnapshot r = reading(85.0, 60.0, 415 * 1.06, I_RATED * 0.95, 90.0, 0.9);
        List<Alert> active = List.of(
                alert("a1", "t1", FaultType.OVERHEATING, Severity.MEDIUM, AlertStatus.NEW),
                alert("a2", "t1", FaultType.LOW_OIL_LEVEL, Severity.MEDIUM, AlertStatus.NEW));
        HealthAssessment a = service.assess(t, r, active, 1, settings, NOW);
        Map<String, HealthFactor> f = byName(a);
        assertThat(f.get("temperature").getPenalty()).isEqualTo(15.0);
        assertThat(f.get("oilLevel").getPenalty()).isEqualTo(12.5);
        assertThat(f.get("load").getPenalty()).isEqualTo(10.0);
        assertThat(f.get("electrical").getPenalty()).isEqualTo(7.5);
        assertThat(f.get("faultHistory").getPenalty()).isEqualTo(7.0); // 3×2 + 1×1
        assertThat(a.score()).isEqualTo(48); // 100 − 52
        assertThat(f.get("temperature").getDetail()).contains("85.0 °C");
        assertThat(f.get("faultHistory").getDetail()).contains("2 active alerts").contains("1 incident resolved");
    }

    @Test
    void penaltiesAreCappedAtTheirWeightAndScoreIsClampedAtZero() {
        ReadingSnapshot r = reading(150.0, 10.0, 415 * 1.3, I_RATED * 2, 200.0, 0.9);
        List<Alert> active = List.of(
                alert("a1", "t1", FaultType.OVERHEATING, Severity.CRITICAL, AlertStatus.NEW),
                alert("a2", "t1", FaultType.LOW_OIL_LEVEL, Severity.CRITICAL, AlertStatus.NEW),
                alert("a3", "t1", FaultType.OVERLOADING, Severity.CRITICAL, AlertStatus.NEW),
                alert("a4", "t1", FaultType.ABNORMAL_CURRENT, Severity.CRITICAL, AlertStatus.NEW));
        HealthAssessment a = service.assess(t, r, active, 20, settings, NOW);
        Map<String, HealthFactor> f = byName(a);
        assertThat(f.get("temperature").getPenalty()).isEqualTo(30);
        assertThat(f.get("oilLevel").getPenalty()).isEqualTo(25);
        assertThat(f.get("load").getPenalty()).isEqualTo(20);
        assertThat(f.get("electrical").getPenalty()).isEqualTo(15);
        assertThat(f.get("faultHistory").getPenalty()).isEqualTo(10);
        assertThat(a.score()).isZero();
        assertThat(a.status()).isEqualTo(TransformerStatus.CRITICAL);
    }

    @Test
    void weightsComeFromSettings() {
        settings.getHealthWeights().setTemperature(50);
        settings.getHealthWeights().setOilLevel(5);
        ReadingSnapshot r = normal();
        r.setTemperatureC(105.0);
        HealthAssessment a = service.assess(t, r, List.of(), 0, settings, NOW);
        assertThat(byName(a).get("temperature").getPenalty()).isEqualTo(50);
        assertThat(byName(a).get("temperature").getMaxPenalty()).isEqualTo(50);
        assertThat(a.score()).isEqualTo(50);
    }

    @Test
    void invalidMetricContributesNoPenalty() {
        ReadingSnapshot r = normal();
        r.setTemperatureC(null);
        HealthAssessment a = service.assess(t, r, List.of(), 0, settings, NOW);
        assertThat(byName(a).get("temperature").getPenalty()).isZero();
        assertThat(byName(a).get("temperature").getDetail()).contains("No valid");
    }

    // ---------- status derivation ----------

    @Test
    void criticalAlertForcesCriticalStatusEvenWithHighScore() {
        HealthAssessment a = service.assess(t, normal(),
                List.of(alert("a1", "t1", FaultType.SENSOR_FAILURE, Severity.HIGH, AlertStatus.NEW)), 0, settings,
                NOW);
        assertThat(a.score()).isGreaterThanOrEqualTo(90);
        assertThat(a.status()).isEqualTo(TransformerStatus.CRITICAL);

        HealthAssessment c = service.assess(t, normal(),
                List.of(alert("a1", "t1", FaultType.OVERHEATING, Severity.CRITICAL, AlertStatus.NEW)), 0, settings,
                NOW);
        assertThat(c.status()).isEqualTo(TransformerStatus.CRITICAL);
    }

    @Test
    void mediumAlertGivesWarning() {
        HealthAssessment a = service.assess(t, normal(),
                List.of(alert("a1", "t1", FaultType.OVERHEATING, Severity.MEDIUM, AlertStatus.NEW)), 0, settings,
                NOW);
        assertThat(a.status()).isEqualTo(TransformerStatus.WARNING);
    }

    @Test
    void scoreBandsDriveStatusWithoutAlerts() {
        assertThat(service.deriveStatus(t, normal(), List.of(), 39, settings, NOW))
                .isEqualTo(TransformerStatus.CRITICAL);
        assertThat(service.deriveStatus(t, normal(), List.of(), 40, settings, NOW))
                .isEqualTo(TransformerStatus.WARNING);
        assertThat(service.deriveStatus(t, normal(), List.of(), 69, settings, NOW))
                .isEqualTo(TransformerStatus.WARNING);
        assertThat(service.deriveStatus(t, normal(), List.of(), 70, settings, NOW))
                .isEqualTo(TransformerStatus.HEALTHY);
    }

    @Test
    void staleOrMissingReadingIsOffline() {
        assertThat(service.assess(t, null, List.of(), 0, settings, NOW).status()).isEqualTo(TransformerStatus.OFFLINE);

        t.setLastReadingAt(NOW.minusSeconds(121));
        assertThat(service.assess(t, normal(), List.of(), 0, settings, NOW).status())
                .isEqualTo(TransformerStatus.OFFLINE);
    }

    @Test
    void openStaleAlertIsOfflineUntilFreshReadingsStartRecovering() {
        Alert stale = alert("s1", "t1", FaultType.STALE_READING, Severity.HIGH, AlertStatus.NEW);
        assertThat(service.assess(t, normal(), List.of(stale), 0, settings, NOW).status())
                .isEqualTo(TransformerStatus.OFFLINE);
        stale.setConsecutiveNormalCount(1);
        assertThat(service.assess(t, normal(), List.of(stale), 0, settings, NOW).status())
                .isEqualTo(TransformerStatus.CRITICAL); // still an active HIGH alert
    }

    @Test
    void networkHealthIsCapacityWeightedOverOnlineTransformers() {
        Transformer a = transformer("a", "A");
        a.setRatedCapacityKva(1000);
        a.setHealthScore(90);
        a.setStatus(TransformerStatus.HEALTHY);
        Transformer b = transformer("b", "B");
        b.setRatedCapacityKva(250);
        b.setHealthScore(40);
        b.setStatus(TransformerStatus.CRITICAL);
        Transformer off = transformer("c", "C");
        off.setRatedCapacityKva(5000);
        off.setHealthScore(0);
        off.setStatus(TransformerStatus.OFFLINE);
        assertThat(service.networkHealth(List.of(a, b, off))).isEqualTo(80); // (90000 + 10000) / 1250
        assertThat(service.networkHealth(List.of(off))).isNull();
    }
}
