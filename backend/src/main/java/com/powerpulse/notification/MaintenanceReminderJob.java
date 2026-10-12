package com.powerpulse.notification;

import com.powerpulse.common.SchedulerLockService;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.settings.SettingsService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically notifies about overdue maintenance (technician + creator) and inspections due within
 * {@code settings.notifications.upcomingInspectionDays} (technician). Dedup keys make repeated runs harmless,
 * and the lease lock prevents concurrent executions.
 */
@Component
public class MaintenanceReminderJob {

    static final String JOB_NAME = "maintenance-reminder";
    private static final Logger log = LoggerFactory.getLogger(MaintenanceReminderJob.class);
    private static final List<MaintenanceStatus> OPEN =
            List.of(MaintenanceStatus.PENDING, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS);

    private final MongoTemplate mongoTemplate;
    private final SchedulerLockService lockService;
    private final SettingsService settingsService;
    private final NotificationServiceImpl notifications;

    public MaintenanceReminderJob(MongoTemplate mongoTemplate, SchedulerLockService lockService,
                                  SettingsService settingsService, NotificationServiceImpl notifications) {
        this.mongoTemplate = mongoTemplate;
        this.lockService = lockService;
        this.settingsService = settingsService;
        this.notifications = notifications;
    }

    @Scheduled(fixedDelayString = "${powerpulse.jobs.maintenance-check-ms:300000}",
            initialDelayString = "${powerpulse.jobs.maintenance-check-initial-ms:60000}")
    public void run() {
        try {
            lockService.tryRun(JOB_NAME, Duration.ofMinutes(4), () -> checkAt(Instant.now()));
        } catch (RuntimeException e) {
            log.warn("Maintenance reminder job failed: {}", e.getMessage());
        }
    }

    /** One pass of the check, relative to {@code now}. Package-visible for tests. */
    void checkAt(Instant now) {
        int days = Math.max(0, settingsService.current().getNotifications().getUpcomingInspectionDays());

        Query overdue = Query.query(Criteria.where("status").in(OPEN).and("dueDate").lt(now));
        try (Stream<MaintenanceTask> tasks = mongoTemplate.stream(overdue, MaintenanceTask.class)) {
            tasks.forEach(notifications::notifyMaintenanceOverdue);
        }

        Query upcoming = Query.query(Criteria.where("status").in(OPEN)
                .and("assignedTechnicianId").ne(null)
                .and("dueDate").gte(now).lte(now.plus(Duration.ofDays(days))));
        try (Stream<MaintenanceTask> tasks = mongoTemplate.stream(upcoming, MaintenanceTask.class)) {
            tasks.forEach(notifications::notifyUpcomingInspection);
        }
    }
}
