package com.powerpulse.settings;

import com.powerpulse.user.Role;
import java.time.Instant;
import java.util.List;

/**
 * Mirror of {@code SystemSettingsDto} in frontend/src/types/api.ts. Used both as the GET response (all fields set)
 * and as the PATCH body (partial: null fields, including nested ones, are left unchanged).
 * Threshold values are configurable demo defaults, not universal electrical-safety limits.
 */
public record SystemSettingsDto(
        ThresholdsDto thresholds,
        Integer sensorTimeoutSeconds,
        Integer recoveryReadings,
        HealthWeightsDto healthWeights,
        NotificationPrefsDto notifications,
        List<String> locations,
        SimulationDto simulation,
        Instant updatedAt,
        String updatedBy) {

    public record ThresholdBandDto(Double good, Double warn, Double critical) {
    }

    public record ThresholdsDto(
            ThresholdBandDto temperatureC,
            ThresholdBandDto oilLevelPct,
            ThresholdBandDto loadPct,
            ThresholdBandDto voltageDeviationPct,
            ThresholdBandDto currentPctOfRated) {
    }

    public record HealthWeightsDto(Double temperature, Double oilLevel, Double load, Double electrical,
                                   Double faultHistory) {
    }

    public record NotificationPrefsDto(List<Role> criticalAlertRoles, List<Role> offlineRoles,
                                       List<Role> resolvedRoles, Integer upcomingInspectionDays) {
    }

    public record SimulationDto(Boolean enabled, Integer intervalSeconds, Double noiseFactor) {
    }

    public static SystemSettingsDto from(SystemSettings s) {
        Thresholds t = s.getThresholds();
        HealthWeights w = s.getHealthWeights();
        NotificationPrefs n = s.getNotifications();
        SimulationConfig sim = s.getSimulation();
        return new SystemSettingsDto(
                new ThresholdsDto(band(t.getTemperatureC()), band(t.getOilLevelPct()), band(t.getLoadPct()),
                        band(t.getVoltageDeviationPct()), band(t.getCurrentPctOfRated())),
                s.getSensorTimeoutSeconds(),
                s.getRecoveryReadings(),
                new HealthWeightsDto(w.getTemperature(), w.getOilLevel(), w.getLoad(), w.getElectrical(),
                        w.getFaultHistory()),
                new NotificationPrefsDto(List.copyOf(n.getCriticalAlertRoles()), List.copyOf(n.getOfflineRoles()),
                        List.copyOf(n.getResolvedRoles()), n.getUpcomingInspectionDays()),
                List.copyOf(s.getLocations()),
                new SimulationDto(sim.isEnabled(), sim.getIntervalSeconds(), sim.getNoiseFactor()),
                s.getUpdatedAt(),
                s.getUpdatedBy());
    }

    private static ThresholdBandDto band(ThresholdBand b) {
        return new ThresholdBandDto(b.getGood(), b.getWarn(), b.getCritical());
    }
}
