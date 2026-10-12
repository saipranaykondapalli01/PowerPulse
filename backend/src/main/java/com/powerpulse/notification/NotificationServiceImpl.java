package com.powerpulse.notification;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.settings.NotificationPrefs;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

/**
 * Creates persistent in-app notifications. Recipients are resolved from the notification preferences in
 * {@code SystemSettings} (roles), the user's region (null = all regions) and task assignment. Every
 * notification carries a dedup key; the unique {@code (recipientId, dedupKey)} index makes each call
 * idempotent per recipient. Notification failures are logged and never propagated to the caller's workflow.
 */
@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ISO_INSTANT;

    private final NotificationRepository repository;
    private final UserRepository userRepository;
    private final SettingsService settingsService;

    public NotificationServiceImpl(NotificationRepository repository, UserRepository userRepository,
                                   SettingsService settingsService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.settingsService = settingsService;
    }

    @Override
    public void notifyNewCriticalAlert(Alert alert) {
        guarded("NEW_CRITICAL_ALERT", () -> {
            Set<String> recipients = recipientsFor(prefs().getCriticalAlertRoles(), alert.getLocation());
            String title = "Critical alert: " + alert.getTransformerCode() + " " + label(alert.getFaultType());
            String message = String.format(Locale.ROOT, "%s (%s, %s) reported %s at severity %s.%s",
                    alert.getTransformerCode(), nullToDash(alert.getTransformerName()), nullToDash(alert.getLocation()),
                    label(alert.getFaultType()), alert.getSeverity(), valueSuffix(alert));
            deliver(recipients, NotificationType.NEW_CRITICAL_ALERT, title, message, ResourceType.ALERT,
                    alert.getId(), "critical:" + alert.getId());
        });
    }

    @Override
    public void notifyIncidentResolved(Alert alert) {
        guarded("INCIDENT_RESOLVED", () -> {
            Set<String> recipients = recipientsFor(prefs().getResolvedRoles(), alert.getLocation());
            if (alert.getAssignedUserId() != null) {
                recipients.add(alert.getAssignedUserId());
            }
            String title = "Incident resolved: " + alert.getTransformerCode() + " " + label(alert.getFaultType());
            Object peak = alert.getPeakSeverity() != null ? alert.getPeakSeverity() : alert.getSeverity();
            String by = alert.getResolvedBy() == null ? "" : " by " + alert.getResolvedBy();
            String notes = alert.getResolutionNotes() == null ? "" : " Notes: " + alert.getResolutionNotes();
            String message = String.format(Locale.ROOT, "%s fault on %s (%s, peak severity %s) was resolved%s.%s",
                    label(alert.getFaultType()), alert.getTransformerCode(), nullToDash(alert.getLocation()),
                    peak, by, notes);
            deliver(recipients, NotificationType.INCIDENT_RESOLVED, title, message, ResourceType.ALERT,
                    alert.getId(), "resolved:" + alert.getId());
        });
    }

    @Override
    public void notifyTransformerOffline(Transformer transformer, Alert staleAlert) {
        guarded("TRANSFORMER_OFFLINE", () -> {
            String location = transformer.getLocation() != null ? transformer.getLocation() : staleAlert.getLocation();
            Set<String> recipients = recipientsFor(prefs().getOfflineRoles(), location);
            String title = "Transformer offline: " + transformer.getCode();
            String last = transformer.getLastReadingAt() == null ? "never"
                    : DUE_FORMAT.format(transformer.getLastReadingAt().truncatedTo(ChronoUnit.SECONDS));
            String message = String.format(Locale.ROOT,
                    "%s (%s, %s) stopped reporting readings (last reading: %s). Severity %s.",
                    transformer.getCode(), nullToDash(transformer.getName()), nullToDash(location), last,
                    staleAlert.getSeverity());
            deliver(recipients, NotificationType.TRANSFORMER_OFFLINE, title, message, ResourceType.TRANSFORMER,
                    transformer.getId(), "offline:" + staleAlert.getId());
        });
    }

    @Override
    public void notifyMaintenanceAssigned(MaintenanceTask task) {
        guarded("MAINTENANCE_ASSIGNED", () -> {
            String technicianId = task.getAssignedTechnicianId();
            if (technicianId == null) {
                return;
            }
            String title = "Maintenance assigned: " + task.getTransformerCode();
            String message = String.format(Locale.ROOT, "You were assigned \"%s\" on %s (%s), priority %s, due %s.",
                    task.getTitle(), task.getTransformerCode(), nullToDash(task.getLocation()), task.getPriority(),
                    formatDue(task.getDueDate()));
            deliver(Set.of(technicianId), NotificationType.MAINTENANCE_ASSIGNED, title, message,
                    ResourceType.MAINTENANCE, task.getId(), "assigned:" + task.getId() + ":" + technicianId);
        });
    }

    /** MAINTENANCE_OVERDUE to the assigned technician and the creator. dedupKey: {@code overdue:<taskId>}. */
    public void notifyMaintenanceOverdue(MaintenanceTask task) {
        guarded("MAINTENANCE_OVERDUE", () -> {
            Set<String> recipients = new LinkedHashSet<>();
            if (task.getAssignedTechnicianId() != null) {
                recipients.add(task.getAssignedTechnicianId());
            }
            if (task.getCreatedById() != null) {
                recipients.add(task.getCreatedById());
            }
            String title = "Maintenance overdue: " + task.getTransformerCode();
            String message = String.format(Locale.ROOT, "\"%s\" on %s (%s, priority %s) was due %s and is still %s.",
                    task.getTitle(), task.getTransformerCode(), nullToDash(task.getLocation()), task.getPriority(),
                    formatDue(task.getDueDate()), task.getStatus());
            deliver(recipients, NotificationType.MAINTENANCE_OVERDUE, title, message, ResourceType.MAINTENANCE,
                    task.getId(), "overdue:" + task.getId());
        });
    }

    /** UPCOMING_INSPECTION to the assigned technician. dedupKey: {@code upcoming:<taskId>}. */
    public void notifyUpcomingInspection(MaintenanceTask task) {
        guarded("UPCOMING_INSPECTION", () -> {
            if (task.getAssignedTechnicianId() == null) {
                return;
            }
            String title = "Upcoming inspection: " + task.getTransformerCode();
            String message = String.format(Locale.ROOT, "\"%s\" on %s (%s, priority %s) is due %s.",
                    task.getTitle(), task.getTransformerCode(), nullToDash(task.getLocation()), task.getPriority(),
                    formatDue(task.getDueDate()));
            deliver(Set.of(task.getAssignedTechnicianId()), NotificationType.UPCOMING_INSPECTION, title, message,
                    ResourceType.MAINTENANCE, task.getId(), "upcoming:" + task.getId());
        });
    }

    /** Active users with one of {@code roles} whose region is unset (all regions) or equals {@code location}. */
    Set<String> recipientsFor(Collection<Role> roles, String location) {
        Set<String> ids = new LinkedHashSet<>();
        if (roles == null || roles.isEmpty()) {
            return ids;
        }
        List<User> users = userRepository.findByRoleInAndActiveTrue(roles);
        for (User user : users) {
            String region = user.getRegion();
            if (region == null || region.isBlank() || (location != null && region.equalsIgnoreCase(location))) {
                ids.add(user.getId());
            }
        }
        return ids;
    }

    private void deliver(Collection<String> recipients, NotificationType type, String title, String message,
                         ResourceType relatedType, String relatedId, String dedupKey) {
        Instant now = Instant.now();
        for (String recipientId : recipients) {
            Notification n = new Notification();
            n.setRecipientId(recipientId);
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setRelatedType(relatedType);
            n.setRelatedId(relatedId);
            n.setRead(false);
            n.setDedupKey(dedupKey);
            n.setCreatedAt(now);
            try {
                repository.insert(n);
            } catch (DuplicateKeyException alreadySent) {
                // Idempotent: this recipient was already notified about this event.
            }
        }
    }

    private void guarded(String what, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            log.warn("Failed to create {} notifications: {}", what, e.getMessage());
        }
    }

    private NotificationPrefs prefs() {
        NotificationPrefs prefs = settingsService.current().getNotifications();
        return prefs != null ? prefs : new NotificationPrefs();
    }

    private static String label(Object faultType) {
        if (faultType == null) {
            return "fault";
        }
        String s = faultType.toString().replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String valueSuffix(Alert alert) {
        if (alert.getMeasuredValue() == null) {
            return "";
        }
        String unit = alert.getUnit() == null ? "" : " " + alert.getUnit();
        String threshold = alert.getThreshold() == null ? ""
                : String.format(Locale.ROOT, " (threshold %.1f%s)", alert.getThreshold(), unit);
        return String.format(Locale.ROOT, " Measured %.1f%s%s.", alert.getMeasuredValue(), unit, threshold);
    }

    private static String formatDue(Instant due) {
        return due == null ? "-" : DUE_FORMAT.format(due.truncatedTo(ChronoUnit.MINUTES));
    }

    private static String nullToDash(String s) {
        return s == null || s.isBlank() ? "-" : s;
    }
}
