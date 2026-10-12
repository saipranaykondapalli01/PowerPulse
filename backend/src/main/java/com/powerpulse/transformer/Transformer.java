package com.powerpulse.transformer;

import com.powerpulse.reading.ReadingSnapshot;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("transformers")
public class Transformer {

    @Id
    private String id;
    @Indexed(unique = true)
    private String code;
    private String name;
    @Indexed
    private String location;
    private double latitude;
    private double longitude;
    private double gridX;
    private double gridZ;
    private List<String> connectedTo = new ArrayList<>();
    private double ratedCapacityKva;
    private double primaryVoltageKv;
    private double secondaryVoltageV;
    private int healthScore = 100;
    private List<HealthFactor> healthFactors = new ArrayList<>();
    @Indexed
    private TransformerStatus status = TransformerStatus.OFFLINE;
    private ReadingSnapshot latestReading;
    private Instant lastReadingAt;
    private Instant lastMaintenanceAt;
    private int activeFaultCount;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    @Version
    private Long version;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public double getGridX() {
        return gridX;
    }

    public void setGridX(double gridX) {
        this.gridX = gridX;
    }

    public double getGridZ() {
        return gridZ;
    }

    public void setGridZ(double gridZ) {
        this.gridZ = gridZ;
    }

    public List<String> getConnectedTo() {
        return connectedTo;
    }

    public void setConnectedTo(List<String> connectedTo) {
        this.connectedTo = connectedTo;
    }

    public double getRatedCapacityKva() {
        return ratedCapacityKva;
    }

    public void setRatedCapacityKva(double ratedCapacityKva) {
        this.ratedCapacityKva = ratedCapacityKva;
    }

    public double getPrimaryVoltageKv() {
        return primaryVoltageKv;
    }

    public void setPrimaryVoltageKv(double primaryVoltageKv) {
        this.primaryVoltageKv = primaryVoltageKv;
    }

    public double getSecondaryVoltageV() {
        return secondaryVoltageV;
    }

    public void setSecondaryVoltageV(double secondaryVoltageV) {
        this.secondaryVoltageV = secondaryVoltageV;
    }

    public int getHealthScore() {
        return healthScore;
    }

    public void setHealthScore(int healthScore) {
        this.healthScore = healthScore;
    }

    public List<HealthFactor> getHealthFactors() {
        return healthFactors;
    }

    public void setHealthFactors(List<HealthFactor> healthFactors) {
        this.healthFactors = healthFactors;
    }

    public TransformerStatus getStatus() {
        return status;
    }

    public void setStatus(TransformerStatus status) {
        this.status = status;
    }

    public ReadingSnapshot getLatestReading() {
        return latestReading;
    }

    public void setLatestReading(ReadingSnapshot latestReading) {
        this.latestReading = latestReading;
    }

    public Instant getLastReadingAt() {
        return lastReadingAt;
    }

    public void setLastReadingAt(Instant lastReadingAt) {
        this.lastReadingAt = lastReadingAt;
    }

    public Instant getLastMaintenanceAt() {
        return lastMaintenanceAt;
    }

    public void setLastMaintenanceAt(Instant lastMaintenanceAt) {
        this.lastMaintenanceAt = lastMaintenanceAt;
    }

    public int getActiveFaultCount() {
        return activeFaultCount;
    }

    public void setActiveFaultCount(int activeFaultCount) {
        this.activeFaultCount = activeFaultCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }
}
