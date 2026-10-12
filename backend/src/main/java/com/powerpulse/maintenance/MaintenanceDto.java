package com.powerpulse.maintenance;

import java.time.Instant;
import java.util.List;

/** Mirrors {@code MaintenanceDto} in frontend/src/types/api.ts. {@code overdue} is computed at response time. */
public record MaintenanceDto(
        String id,
        String transformerId,
        String transformerCode,
        String transformerName,
        String location,
        String alertId,
        String title,
        String description,
        Priority priority,
        MaintenanceStatus status,
        String assignedTechnicianId,
        String assignedTechnicianName,
        Instant dueDate,
        boolean overdue,
        String inspectionFindings,
        List<WorkNoteDto> workNotes,
        List<PartReplacedDto> partsReplaced,
        Instant completedAt,
        Instant cancelledAt,
        String cancelReason,
        String createdById,
        String createdByName,
        List<TaskHistoryEntryDto> history,
        Instant createdAt,
        Instant updatedAt) {

    /** Mirrors {@code WorkNote}. */
    public record WorkNoteDto(Instant at, String authorId, String authorName, String text) {
    }

    /** Mirrors {@code PartReplaced}. */
    public record PartReplacedDto(String name, int quantity, String notes) {
    }

    /** Mirrors {@code TaskHistoryEntry}. */
    public record TaskHistoryEntryDto(Instant at, String actorName, String action, String detail) {
    }

    public static boolean isTerminal(MaintenanceStatus status) {
        return status == MaintenanceStatus.COMPLETED || status == MaintenanceStatus.CANCELLED;
    }

    public static boolean isOverdue(MaintenanceTask t, Instant now) {
        return t.getDueDate() != null && t.getDueDate().isBefore(now) && !isTerminal(t.getStatus());
    }

    public static MaintenanceDto from(MaintenanceTask t) {
        Instant now = Instant.now();
        return new MaintenanceDto(t.getId(), t.getTransformerId(), t.getTransformerCode(), t.getTransformerName(),
                t.getLocation(), t.getAlertId(), t.getTitle(), t.getDescription(), t.getPriority(), t.getStatus(),
                t.getAssignedTechnicianId(), t.getAssignedTechnicianName(), t.getDueDate(), isOverdue(t, now),
                t.getInspectionFindings(),
                t.getWorkNotes() == null ? List.of() : t.getWorkNotes().stream()
                        .map(n -> new WorkNoteDto(n.getAt(), n.getAuthorId(), n.getAuthorName(), n.getText())).toList(),
                t.getPartsReplaced() == null ? List.of() : t.getPartsReplaced().stream()
                        .map(p -> new PartReplacedDto(p.getName(), p.getQuantity(), p.getNotes())).toList(),
                t.getCompletedAt(), t.getCancelledAt(), t.getCancelReason(), t.getCreatedById(), t.getCreatedByName(),
                t.getHistory() == null ? List.of() : t.getHistory().stream()
                        .map(h -> new TaskHistoryEntryDto(h.getAt(), h.getActorName(), h.getAction(), h.getDetail()))
                        .toList(),
                t.getCreatedAt(), t.getUpdatedAt());
    }
}
