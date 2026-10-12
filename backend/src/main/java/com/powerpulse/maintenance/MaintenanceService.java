package com.powerpulse.maintenance;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertLinkService;
import com.powerpulse.alert.AlertRepository;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.ForbiddenException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.dashboard.QuerySupport;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.security.AuthenticatedUser;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Maintenance task lifecycle: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED, or → CANCELLED from any open state.
 * COMPLETED and CANCELLED are terminal and immutable. Role checks complement the controller's
 * {@code @PreAuthorize}: technicians only ever see and progress their own tasks, and field-level permissions
 * follow docs/security.md. Tasks are never deleted.
 */
@Service
public class MaintenanceService {

    static final List<MaintenanceStatus> OPEN =
            List.of(MaintenanceStatus.PENDING, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS);
    private static final Set<String> SORTABLE = Set.of("dueDate", "createdAt", "priority", "status");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "dueDate");
    private static final Map<String, List<String>> RANKED = Map.of(
            "priority", QuerySupport.names(Priority.class),
            "status", QuerySupport.names(MaintenanceStatus.class));
    /** Due dates may be at most this far in the past (allows back-dating a task created late in the day). */
    private static final Duration MAX_PAST_DUE = Duration.ofDays(1);

    private final MaintenanceTaskRepository repository;
    private final TransformerRepository transformerRepository;
    private final UserRepository userRepository;
    private final AlertRepository alertRepository;
    private final AlertLinkService alertLinkService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final SettingsService settingsService;
    private final MongoTemplate mongoTemplate;

    public MaintenanceService(MaintenanceTaskRepository repository, TransformerRepository transformerRepository,
                              UserRepository userRepository, AlertRepository alertRepository,
                              AlertLinkService alertLinkService, NotificationService notificationService,
                              AuditService auditService, SettingsService settingsService,
                              MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.transformerRepository = transformerRepository;
        this.userRepository = userRepository;
        this.alertRepository = alertRepository;
        this.alertLinkService = alertLinkService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.settingsService = settingsService;
        this.mongoTemplate = mongoTemplate;
    }

    // ---------------------------------------------------------------- create

    public MaintenanceDto create(MaintenanceCreateRequest req) {
        AuthenticatedUser user = CurrentUser.require();
        if (!isManager(user)) {
            throw new ForbiddenException("Only administrators and engineers can create maintenance tasks");
        }
        Transformer transformer = transformerRepository.findById(req.transformerId())
                .orElseThrow(() -> new NotFoundException("Transformer", req.transformerId()));
        validateDueDate(req.dueDate());
        if (req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("title must not be blank");
        }
        String alertId = blankToNull(req.alertId());
        if (alertId != null) {
            Alert alert = alertRepository.findById(alertId).orElseThrow(() -> new NotFoundException("Alert", alertId));
            if (!Objects.equals(alert.getTransformerId(), transformer.getId())) {
                throw new BadRequestException("Alert " + alertId + " does not belong to transformer " + transformer.getCode());
            }
        }
        String technicianId = blankToNull(req.assignedTechnicianId());
        User technician = technicianId == null ? null : requireTechnician(technicianId);

        Instant now = Instant.now();
        MaintenanceTask task = new MaintenanceTask();
        task.setTransformerId(transformer.getId());
        task.setTransformerCode(transformer.getCode());
        task.setTransformerName(transformer.getName());
        task.setLocation(transformer.getLocation());
        task.setAlertId(alertId);
        task.setTitle(req.title().trim());
        task.setDescription(blankToNull(req.description()));
        task.setPriority(req.priority());
        task.setDueDate(req.dueDate());
        task.setCreatedById(user.id());
        task.setCreatedByName(user.name());
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        addHistory(task, user, "CREATED", "Task created for " + transformer.getCode()
                + (alertId != null ? " from alert " + alertId : ""));
        if (technician != null) {
            task.setAssignedTechnicianId(technician.getId());
            task.setAssignedTechnicianName(technician.getName());
            task.setStatus(MaintenanceStatus.ASSIGNED);
            addHistory(task, user, "ASSIGNED", "Assigned to " + technician.getName());
        } else {
            task.setStatus(MaintenanceStatus.PENDING);
        }
        task = repository.insert(task);

        if (alertId != null) {
            alertLinkService.linkMaintenance(alertId, task.getId());
        }
        if (technician != null) {
            notificationService.notifyMaintenanceAssigned(task);
        }
        auditService.record("MAINTENANCE_CREATED", ResourceType.MAINTENANCE, task.getId(),
                "Created maintenance task \"" + task.getTitle() + "\" on " + task.getTransformerCode()
                        + " (priority " + task.getPriority() + ", status " + task.getStatus() + ")");
        return MaintenanceDto.from(task);
    }

    // ---------------------------------------------------------------- read

    public PageResponse<MaintenanceDto> list(String q, MaintenanceStatus status, Priority priority, String technicianId,
                                             String transformerId, Boolean overdue, Boolean upcoming,
                                             Pageable requested) {
        AuthenticatedUser user = CurrentUser.require();
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        List<Criteria> parts = new ArrayList<>();
        if (user.role() == Role.TECHNICIAN) {
            // Technicians are always restricted to their own tasks, whatever filter they send.
            parts.add(Criteria.where("assignedTechnicianId").is(user.id()));
        } else if (technicianId != null && !technicianId.isBlank()) {
            parts.add(Criteria.where("assignedTechnicianId").is(technicianId));
        }
        if (q != null && !q.isBlank()) {
            String pattern = Pattern.quote(q.trim());
            parts.add(new Criteria().orOperator(
                    Criteria.where("title").regex(pattern, "i"),
                    Criteria.where("transformerCode").regex(pattern, "i")));
        }
        if (status != null) {
            parts.add(Criteria.where("status").is(status));
        }
        if (priority != null) {
            parts.add(Criteria.where("priority").is(priority));
        }
        if (transformerId != null && !transformerId.isBlank()) {
            parts.add(Criteria.where("transformerId").is(transformerId));
        }
        Instant now = Instant.now();
        List<Criteria> dueWindows = new ArrayList<>();
        if (Boolean.TRUE.equals(overdue)) {
            dueWindows.add(Criteria.where("dueDate").lt(now));
        }
        if (Boolean.TRUE.equals(upcoming)) {
            dueWindows.add(Criteria.where("dueDate").gte(now).lte(now.plus(Duration.ofDays(upcomingDays()))));
        }
        if (!dueWindows.isEmpty()) {
            parts.add(Criteria.where("status").in(OPEN));
            parts.add(dueWindows.size() == 1 ? dueWindows.get(0)
                    : new Criteria().orOperator(dueWindows.toArray(new Criteria[0])));
        }
        Criteria criteria = parts.isEmpty() ? new Criteria() : new Criteria().andOperator(parts.toArray(new Criteria[0]));
        return QuerySupport.page(mongoTemplate, criteria, pageable, MaintenanceTask.class, RANKED,
                MaintenanceDto::from);
    }

    public MaintenanceDto get(String id) {
        AuthenticatedUser user = CurrentUser.require();
        MaintenanceTask task = load(id);
        requireCanView(user, task);
        return MaintenanceDto.from(task);
    }

    public List<MaintenanceDto> forTransformer(String transformerId) {
        AuthenticatedUser user = CurrentUser.require();
        if (!transformerRepository.existsById(transformerId)) {
            throw new NotFoundException("Transformer", transformerId);
        }
        List<MaintenanceTask> tasks = user.role() == Role.TECHNICIAN
                ? repository.findByTransformerIdAndAssignedTechnicianIdOrderByCreatedAtDesc(transformerId, user.id())
                : repository.findByTransformerIdOrderByCreatedAtDesc(transformerId);
        return tasks.stream().map(MaintenanceDto::from).toList();
    }

    // ---------------------------------------------------------------- update

    public MaintenanceDto update(String id, MaintenanceUpdateRequest req) {
        AuthenticatedUser user = CurrentUser.require();
        MaintenanceTask task = load(id);
        boolean manager = isManager(user);
        if (!manager) {
            requireAssignedTechnician(user, task);
            if (req.touchesManagerFields()) {
                throw new ForbiddenException("Technicians may only start work, record findings, work notes and parts");
            }
        }
        requireNotTerminal(task);

        List<String> changes = new ArrayList<>();
        String auditAction = "MAINTENANCE_UPDATED";
        boolean assignmentChanged = false;

        if (req.title() != null) {
            if (req.title().isBlank()) {
                throw new BadRequestException("title must not be blank");
            }
            String title = req.title().trim();
            if (!title.equals(task.getTitle())) {
                changes.add(change(task, user, "UPDATED", "Title changed to \"" + title + "\""));
                task.setTitle(title);
            }
        }
        if (req.description() != null && !req.description().equals(task.getDescription())) {
            task.setDescription(blankToNull(req.description()));
            changes.add(change(task, user, "UPDATED", "Description updated"));
        }
        if (req.priority() != null && req.priority() != task.getPriority()) {
            changes.add(change(task, user, "UPDATED", "Priority " + task.getPriority() + " → " + req.priority()));
            task.setPriority(req.priority());
        }
        if (req.dueDate() != null && !req.dueDate().equals(task.getDueDate())) {
            validateDueDate(req.dueDate());
            changes.add(change(task, user, "UPDATED", "Due date " + task.getDueDate() + " → " + req.dueDate()));
            task.setDueDate(req.dueDate());
        }
        if (req.assignedTechnicianId() != null) {
            String techId = blankToNull(req.assignedTechnicianId());
            if (techId == null) {
                throw new BadRequestException("assignedTechnicianId must not be blank");
            }
            if (!techId.equals(task.getAssignedTechnicianId())) {
                User technician = requireTechnician(techId);
                String previous = task.getAssignedTechnicianName();
                task.setAssignedTechnicianId(technician.getId());
                task.setAssignedTechnicianName(technician.getName());
                if (task.getStatus() == MaintenanceStatus.PENDING) {
                    task.setStatus(MaintenanceStatus.ASSIGNED);
                }
                changes.add(change(task, user, previous == null ? "ASSIGNED" : "REASSIGNED",
                        previous == null ? "Assigned to " + technician.getName()
                                : "Reassigned from " + previous + " to " + technician.getName()));
                assignmentChanged = true;
                auditAction = "MAINTENANCE_ASSIGNED";
            }
        }
        if (req.status() != null && req.status() != task.getStatus()) {
            switch (req.status()) {
                case IN_PROGRESS -> {
                    if (task.getStatus() != MaintenanceStatus.ASSIGNED) {
                        throw new ConflictException("Only ASSIGNED tasks can be started (current status "
                                + task.getStatus() + ")");
                    }
                    task.setStatus(MaintenanceStatus.IN_PROGRESS);
                    changes.add(change(task, user, "STARTED", "Work started"));
                    auditAction = "MAINTENANCE_STARTED";
                }
                case CANCELLED -> {
                    if (req.cancelReason() == null || req.cancelReason().isBlank()) {
                        throw new BadRequestException("cancelReason is required to cancel a task");
                    }
                    task.setStatus(MaintenanceStatus.CANCELLED);
                    task.setCancelledAt(Instant.now());
                    task.setCancelReason(req.cancelReason().trim());
                    changes.add(change(task, user, "CANCELLED", "Cancelled: " + task.getCancelReason()));
                    auditAction = "MAINTENANCE_CANCELLED";
                }
                case COMPLETED -> throw new ConflictException("Use POST /maintenance/{id}/complete to complete a task");
                default -> throw new ConflictException("Illegal status transition " + task.getStatus() + " → "
                        + req.status());
            }
        }
        if (req.inspectionFindings() != null && !req.inspectionFindings().equals(task.getInspectionFindings())) {
            task.setInspectionFindings(blankToNull(req.inspectionFindings()));
            changes.add(change(task, user, "FINDINGS_UPDATED", "Inspection findings updated"));
        }
        if (req.addWorkNote() != null) {
            if (req.addWorkNote().isBlank()) {
                throw new BadRequestException("addWorkNote must not be blank");
            }
            addWorkNote(task, user, req.addWorkNote());
            changes.add(change(task, user, "WORK_NOTE_ADDED", null));
        }
        if (req.addPart() != null) {
            PartReplaced part = new PartReplaced();
            part.setName(req.addPart().name().trim());
            part.setQuantity(req.addPart().quantity());
            part.setNotes(blankToNull(req.addPart().notes()));
            task.getPartsReplaced().add(part);
            changes.add(change(task, user, "PART_ADDED", part.getQuantity() + " × " + part.getName()));
        }

        if (changes.isEmpty()) {
            return MaintenanceDto.from(task);
        }
        task.setUpdatedAt(Instant.now());
        task = repository.save(task);
        if (assignmentChanged && !MaintenanceDto.isTerminal(task.getStatus())) {
            notificationService.notifyMaintenanceAssigned(task);
        }
        auditService.record(auditAction, ResourceType.MAINTENANCE, task.getId(),
                task.getTransformerCode() + " \"" + task.getTitle() + "\": " + String.join("; ", changes));
        return MaintenanceDto.from(task);
    }

    // ---------------------------------------------------------------- complete

    public MaintenanceDto complete(String id, MaintenanceCompleteRequest req) {
        AuthenticatedUser user = CurrentUser.require();
        MaintenanceTask task = load(id);
        if (!isManager(user)) {
            requireAssignedTechnician(user, task);
        }
        if (task.getStatus() != MaintenanceStatus.IN_PROGRESS) {
            throw new ConflictException("Only IN_PROGRESS tasks can be completed (current status " + task.getStatus() + ")");
        }
        Instant now = Instant.now();
        if (req != null && req.inspectionFindings() != null && !req.inspectionFindings().isBlank()) {
            task.setInspectionFindings(req.inspectionFindings().trim());
        }
        if (req != null && req.workNote() != null && !req.workNote().isBlank()) {
            addWorkNote(task, user, req.workNote());
        }
        task.setStatus(MaintenanceStatus.COMPLETED);
        task.setCompletedAt(now);
        task.setUpdatedAt(now);
        addHistory(task, user, "COMPLETED", "Task completed");
        task = repository.save(task);

        // Field-scoped update: never overwrite the transformer document written concurrently by the reading pipeline.
        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(task.getTransformerId())),
                new Update().set("lastMaintenanceAt", now).inc("version", 1), Transformer.class);

        auditService.record("MAINTENANCE_COMPLETED", ResourceType.MAINTENANCE, task.getId(),
                "Completed maintenance task \"" + task.getTitle() + "\" on " + task.getTransformerCode());
        return MaintenanceDto.from(task);
    }

    // ---------------------------------------------------------------- helpers

    private MaintenanceTask load(String id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Maintenance task", id));
    }

    private static boolean isManager(AuthenticatedUser user) {
        return user.hasRole(Role.ADMIN, Role.ENGINEER);
    }

    private static void requireCanView(AuthenticatedUser user, MaintenanceTask task) {
        if (user.role() == Role.TECHNICIAN && !user.id().equals(task.getAssignedTechnicianId())) {
            throw new ForbiddenException("Technicians can only view their own assigned tasks");
        }
    }

    private static void requireAssignedTechnician(AuthenticatedUser user, MaintenanceTask task) {
        if (user.role() != Role.TECHNICIAN) {
            throw new ForbiddenException("You do not have permission to modify maintenance tasks");
        }
        if (!user.id().equals(task.getAssignedTechnicianId())) {
            throw new ForbiddenException("Technicians can only update their own assigned tasks");
        }
    }

    private static void requireNotTerminal(MaintenanceTask task) {
        if (MaintenanceDto.isTerminal(task.getStatus())) {
            throw new ConflictException("Task is " + task.getStatus() + " and can no longer be modified");
        }
    }

    private User requireTechnician(String userId) {
        User technician = userRepository.findById(userId).orElse(null);
        if (technician == null || !technician.isActive() || technician.getRole() != Role.TECHNICIAN) {
            throw new BadRequestException("assignedTechnicianId must reference an active technician");
        }
        return technician;
    }

    private static void validateDueDate(Instant dueDate) {
        if (dueDate == null) {
            throw new BadRequestException("dueDate is required");
        }
        if (dueDate.isBefore(Instant.now().minus(MAX_PAST_DUE))) {
            throw new BadRequestException("dueDate must not be more than one day in the past");
        }
    }

    private int upcomingDays() {
        return Math.max(0, settingsService.current().getNotifications().getUpcomingInspectionDays());
    }

    private static void addWorkNote(MaintenanceTask task, AuthenticatedUser user, String text) {
        WorkNote note = new WorkNote();
        note.setAt(Instant.now());
        note.setAuthorId(user.id());
        note.setAuthorName(user.name());
        note.setText(text.trim());
        task.getWorkNotes().add(note);
    }

    private static String change(MaintenanceTask task, AuthenticatedUser user, String action, String detail) {
        addHistory(task, user, action, detail);
        return detail == null ? action : detail;
    }

    private static void addHistory(MaintenanceTask task, AuthenticatedUser user, String action, String detail) {
        TaskHistoryEntry entry = new TaskHistoryEntry();
        entry.setAt(Instant.now());
        entry.setActorName(user.name());
        entry.setAction(action);
        entry.setDetail(detail);
        task.getHistory().add(entry);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
