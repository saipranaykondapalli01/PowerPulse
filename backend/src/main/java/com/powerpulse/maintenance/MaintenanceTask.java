package com.powerpulse.maintenance;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("maintenance_tasks")
public class MaintenanceTask {

    @Id
    private String id;
    @Indexed
    private String transformerId;
    private String transformerCode;
    private String transformerName;
    private String location;
    @Indexed
    private String alertId;
    private String title;
    private String description;
    private Priority priority = Priority.MEDIUM;
    @Indexed
    private MaintenanceStatus status = MaintenanceStatus.PENDING;
    @Indexed
    private String assignedTechnicianId;
    private String assignedTechnicianName;
    @Indexed
    private Instant dueDate;
    private String inspectionFindings;
    private List<WorkNote> workNotes = new ArrayList<>();
    private List<PartReplaced> partsReplaced = new ArrayList<>();
    private Instant completedAt;
    private Instant cancelledAt;
    private String cancelReason;
    private String createdById;
    private String createdByName;
    private List<TaskHistoryEntry> history = new ArrayList<>();
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

    public String getTransformerId() {
        return transformerId;
    }

    public void setTransformerId(String transformerId) {
        this.transformerId = transformerId;
    }

    public String getTransformerCode() {
        return transformerCode;
    }

    public void setTransformerCode(String transformerCode) {
        this.transformerCode = transformerCode;
    }

    public String getTransformerName() {
        return transformerName;
    }

    public void setTransformerName(String transformerName) {
        this.transformerName = transformerName;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getAlertId() {
        return alertId;
    }

    public void setAlertId(String alertId) {
        this.alertId = alertId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public MaintenanceStatus getStatus() {
        return status;
    }

    public void setStatus(MaintenanceStatus status) {
        this.status = status;
    }

    public String getAssignedTechnicianId() {
        return assignedTechnicianId;
    }

    public void setAssignedTechnicianId(String assignedTechnicianId) {
        this.assignedTechnicianId = assignedTechnicianId;
    }

    public String getAssignedTechnicianName() {
        return assignedTechnicianName;
    }

    public void setAssignedTechnicianName(String assignedTechnicianName) {
        this.assignedTechnicianName = assignedTechnicianName;
    }

    public Instant getDueDate() {
        return dueDate;
    }

    public void setDueDate(Instant dueDate) {
        this.dueDate = dueDate;
    }

    public String getInspectionFindings() {
        return inspectionFindings;
    }

    public void setInspectionFindings(String inspectionFindings) {
        this.inspectionFindings = inspectionFindings;
    }

    public List<WorkNote> getWorkNotes() {
        return workNotes;
    }

    public void setWorkNotes(List<WorkNote> workNotes) {
        this.workNotes = workNotes;
    }

    public List<PartReplaced> getPartsReplaced() {
        return partsReplaced;
    }

    public void setPartsReplaced(List<PartReplaced> partsReplaced) {
        this.partsReplaced = partsReplaced;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(Instant cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }

    public String getCreatedById() {
        return createdById;
    }

    public void setCreatedById(String createdById) {
        this.createdById = createdById;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public List<TaskHistoryEntry> getHistory() {
        return history;
    }

    public void setHistory(List<TaskHistoryEntry> history) {
        this.history = history;
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
