package com.powerpulse.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ApiError;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SettingsServiceImplTest {

    private static List<String> fields(SystemSettings s) {
        return SettingsServiceImpl.validate(s).stream().map(ApiError.FieldError::field).toList();
    }

    @Test
    void defaultsAreValid() {
        assertThat(SettingsServiceImpl.validate(new SystemSettings())).isEmpty();
    }

    @Test
    void higherIsWorseThresholdsMustBeAscending() {
        SystemSettings s = new SystemSettings();
        s.getThresholds().getTemperatureC().setWarn(110); // warn > critical
        s.getThresholds().getLoadPct().setGood(90);       // good == warn
        assertThat(fields(s)).contains("thresholds.temperatureC", "thresholds.loadPct");
    }

    @Test
    void oilThresholdsMustBeDescending() {
        SystemSettings s = new SystemSettings();
        s.getThresholds().getOilLevelPct().setWarn(30); // below critical 40
        assertThat(fields(s)).containsExactly("thresholds.oilLevelPct");
    }

    @Test
    void weightsMustSumTo100WithinTolerance() {
        SystemSettings s = new SystemSettings();
        s.getHealthWeights().setTemperature(30.005);
        assertThat(SettingsServiceImpl.validate(s)).isEmpty();
        s.getHealthWeights().setTemperature(31);
        assertThat(fields(s)).containsExactly("healthWeights");
    }

    @Test
    void scalarRanges() {
        SystemSettings s = new SystemSettings();
        s.setSensorTimeoutSeconds(9);
        s.setRecoveryReadings(21);
        s.getSimulation().setIntervalSeconds(1);
        assertThat(fields(s)).containsExactlyInAnyOrder("sensorTimeoutSeconds", "recoveryReadings",
                "simulation.intervalSeconds");
        s.setSensorTimeoutSeconds(10);
        s.setRecoveryReadings(1);
        s.getSimulation().setIntervalSeconds(3600);
        assertThat(SettingsServiceImpl.validate(s)).isEmpty();
        s.setRecoveryReadings(0);
        s.getSimulation().setIntervalSeconds(3601);
        assertThat(fields(s)).containsExactlyInAnyOrder("recoveryReadings", "simulation.intervalSeconds");
    }

    @Test
    void locationsMustBeNonBlankAndUnique() {
        SystemSettings s = new SystemSettings();
        s.setLocations(List.of("A", " "));
        assertThat(fields(s)).containsExactly("locations");
        s.setLocations(List.of("A", "a"));
        assertThat(fields(s)).containsExactly("locations");
        s.setLocations(List.of());
        assertThat(fields(s)).containsExactly("locations");
    }

    @Test
    void currentCreatesDefaultsWhenAbsentAndCachesUntilUpdate() {
        SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        when(repo.findById(SystemSettings.GLOBAL_ID)).thenReturn(Optional.empty());
        when(repo.insert(any(SystemSettings.class))).thenAnswer(inv -> inv.getArgument(0));
        when(repo.save(any(SystemSettings.class))).thenAnswer(inv -> inv.getArgument(0));
        SettingsServiceImpl service = new SettingsServiceImpl(repo, mock(AuditService.class));

        SystemSettings first = service.current();
        assertThat(first.getSensorTimeoutSeconds()).isEqualTo(120);
        assertThat(service.current()).isSameAs(first);
        verify(repo, times(1)).insert(any(SystemSettings.class));

        service.update(new SystemSettingsDto(null, 300, null, null, null, null, null, null, null));
        assertThat(service.current()).isNotSameAs(first); // cache invalidated
    }

    @Test
    void invalidUpdateThrowsWithFieldErrors() {
        SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        when(repo.findById(SystemSettings.GLOBAL_ID)).thenReturn(Optional.of(new SystemSettings()));
        SettingsServiceImpl service = new SettingsServiceImpl(repo, mock(AuditService.class));
        assertThatThrownBy(() -> service.update(new SystemSettingsDto(null, 5, null, null, null, null, null, null,
                null)))
                .isInstanceOfSatisfying(SettingsValidationException.class, e ->
                        assertThat(e.getFieldErrors()).extracting(ApiError.FieldError::field)
                                .containsExactly("sensorTimeoutSeconds"));
    }
}
