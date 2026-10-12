package com.powerpulse.settings;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("system_settings")
public class SystemSettings {

    public static final String GLOBAL_ID = "global";

    @Id
    private String id = GLOBAL_ID;
    private Thresholds thresholds = new Thresholds();
    private int sensorTimeoutSeconds = 120;
    private int recoveryReadings = 3;
    private HealthWeights healthWeights = new HealthWeights();
    private NotificationPrefs notifications = new NotificationPrefs();
    private List<String> locations = new ArrayList<>(List.of("North Ridge", "Harbor District", "Eastfield", "Old Town", "Riverside"));
    private SimulationConfig simulation = new SimulationConfig();
    private Instant updatedAt;
    private String updatedBy;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Thresholds getThresholds() {
        return thresholds;
    }

    public void setThresholds(Thresholds thresholds) {
        this.thresholds = thresholds;
    }

    public int getSensorTimeoutSeconds() {
        return sensorTimeoutSeconds;
    }

    public void setSensorTimeoutSeconds(int sensorTimeoutSeconds) {
        this.sensorTimeoutSeconds = sensorTimeoutSeconds;
    }

    public int getRecoveryReadings() {
        return recoveryReadings;
    }

    public void setRecoveryReadings(int recoveryReadings) {
        this.recoveryReadings = recoveryReadings;
    }

    public HealthWeights getHealthWeights() {
        return healthWeights;
    }

    public void setHealthWeights(HealthWeights healthWeights) {
        this.healthWeights = healthWeights;
    }

    public NotificationPrefs getNotifications() {
        return notifications;
    }

    public void setNotifications(NotificationPrefs notifications) {
        this.notifications = notifications;
    }

    public List<String> getLocations() {
        return locations;
    }

    public void setLocations(List<String> locations) {
        this.locations = locations;
    }

    public SimulationConfig getSimulation() {
        return simulation;
    }

    public void setSimulation(SimulationConfig simulation) {
        this.simulation = simulation;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }
}
