package com.powerpulse.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.SchedulerLockService;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.MaintenanceTaskRepository;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.support.Fixtures;
import com.powerpulse.support.MongoWorkflowTest;
import com.powerpulse.support.TestAuth;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStatus;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@MongoWorkflowTest
@Import({NotificationServiceImpl.class, NotificationInboxService.class, MaintenanceReminderJob.class,
        SchedulerLockService.class})
class NotificationServiceTest {

    @Autowired NotificationServiceImpl service;
    @Autowired NotificationInboxService inbox;
    @Autowired MaintenanceReminderJob job;
    @Autowired NotificationRepository repository;
    @Autowired UserRepository userRepository;
    @Autowired TransformerRepository transformerRepository;
    @Autowired MaintenanceTaskRepository taskRepository;
    @Autowired MongoTemplate mongoTemplate;

    @MockitoBean SettingsService settingsService;

    SystemSettings settings;
    Transformer north;
    User admin;          // all regions
    User engineerNorth;  // North Ridge
    User operatorSouth;  // Riverside
    User operatorAll;    // all regions
    User tech;           // all regions
    User inactiveAdmin;

    @BeforeEach
    void setUp() {
        Fixtures.clean(mongoTemplate);
        settings = new SystemSettings();
        when(settingsService.current()).thenReturn(settings);
        north = transformerRepository.save(
                Fixtures.transformer("PP-TX-007", "North Ridge", TransformerStatus.CRITICAL, 30, 500, 90.0));
        admin = userRepository.save(Fixtures.user("Ada Admin", Role.ADMIN, null, true));
        engineerNorth = userRepository.save(Fixtures.user("Ned North", Role.ENGINEER, "North Ridge", true));
        operatorSouth = userRepository.save(Fixtures.user("Sue South", Role.OPERATOR, "Riverside", true));
        operatorAll = userRepository.save(Fixtures.user("Otto Ops", Role.OPERATOR, "", true));
        tech = userRepository.save(Fixtures.user("Tess Tech", Role.TECHNICIAN, null, true));
        inactiveAdmin = userRepository.save(Fixtures.user("Gone Admin", Role.ADMIN, null, false));
    }

    @AfterEach
    void tearDown() {
        TestAuth.logout();
    }

    private Alert savedAlert(Severity severity) {
        Alert alert = Fixtures.alert(north, FaultType.OVERHEATING, severity, true, Instant.now());
        return mongoTemplate.insert(alert);
    }

    private Set<String> recipientsOf(NotificationType type) {
        return repository.findAll().stream().filter(n -> n.getType() == type)
                .map(Notification::getRecipientId).collect(Collectors.toSet());
    }

    // ------------------------------------------------------------ recipients & dedup

    @Test
    void criticalAlertGoesToConfiguredRolesInMatchingRegionAndIsIdempotent() {
        Alert alert = savedAlert(Severity.CRITICAL);

        service.notifyNewCriticalAlert(alert);
        service.notifyNewCriticalAlert(alert);

        assertThat(recipientsOf(NotificationType.NEW_CRITICAL_ALERT))
                .containsExactlyInAnyOrder(admin.getId(), engineerNorth.getId(), operatorAll.getId());
        assertThat(repository.count()).isEqualTo(3);
        Notification n = repository.findAll().get(0);
        assertThat(n.getTitle()).contains("PP-TX-007").contains("Overheating");
        assertThat(n.getMessage()).contains("PP-TX-007").contains("CRITICAL").contains("Overheating");
        assertThat(n.getRelatedType()).isEqualTo(ResourceType.ALERT);
        assertThat(n.getRelatedId()).isEqualTo(alert.getId());
        assertThat(n.getDedupKey()).isEqualTo("critical:" + alert.getId());
        assertThat(n.isRead()).isFalse();
        assertThat(n.getCreatedAt()).isNotNull();
    }

    @Test
    void recipientsFollowConfiguredRoles() {
        settings.getNotifications().setCriticalAlertRoles(List.of(Role.TECHNICIAN));
        service.notifyNewCriticalAlert(savedAlert(Severity.CRITICAL));
        assertThat(recipientsOf(NotificationType.NEW_CRITICAL_ALERT)).containsExactly(tech.getId());
    }

    @Test
    void resolvedGoesToResolvedRolesPlusAssignee() {
        Alert alert = savedAlert(Severity.HIGH);
        alert.setAssignedUserId(operatorSouth.getId());
        alert.setResolvedBy("Ada Admin");
        alert.setResolutionNotes("Cleaned radiator fins");

        service.notifyIncidentResolved(alert);
        service.notifyIncidentResolved(alert);

        assertThat(recipientsOf(NotificationType.INCIDENT_RESOLVED))
                .containsExactlyInAnyOrder(admin.getId(), engineerNorth.getId(), operatorSouth.getId());
        assertThat(repository.count()).isEqualTo(3);
        assertThat(repository.findAll()).allSatisfy(n -> {
            assertThat(n.getDedupKey()).isEqualTo("resolved:" + alert.getId());
            assertThat(n.getMessage()).contains("Cleaned radiator fins");
        });
    }

    @Test
    void offlineGoesToOfflineRolesAndLinksTheTransformer() {
        Alert stale = Fixtures.alert(north, FaultType.STALE_READING, Severity.HIGH, true, Instant.now());
        stale = mongoTemplate.insert(stale);

        service.notifyTransformerOffline(north, stale);
        service.notifyTransformerOffline(north, stale);

        assertThat(recipientsOf(NotificationType.TRANSFORMER_OFFLINE))
                .containsExactlyInAnyOrder(admin.getId(), engineerNorth.getId(), operatorAll.getId());
        assertThat(repository.findAll()).allSatisfy(n -> {
            assertThat(n.getRelatedType()).isEqualTo(ResourceType.TRANSFORMER);
            assertThat(n.getRelatedId()).isEqualTo(north.getId());
        });
    }

    @Test
    void maintenanceAssignedGoesToTechnicianOncePerAssignment() {
        MaintenanceTask task = taskRepository.save(Fixtures.task(north, "Oil top-up", MaintenanceStatus.ASSIGNED,
                Priority.HIGH, Instant.now().plus(Duration.ofDays(5)), Instant.now()));
        task.setAssignedTechnicianId(tech.getId());

        service.notifyMaintenanceAssigned(task);
        service.notifyMaintenanceAssigned(task);

        assertThat(repository.findAll()).singleElement().satisfies(n -> {
            assertThat(n.getRecipientId()).isEqualTo(tech.getId());
            assertThat(n.getType()).isEqualTo(NotificationType.MAINTENANCE_ASSIGNED);
            assertThat(n.getDedupKey()).isEqualTo("assigned:" + task.getId() + ":" + tech.getId());
            assertThat(n.getRelatedType()).isEqualTo(ResourceType.MAINTENANCE);
            assertThat(n.getMessage()).contains("Oil top-up").contains("PP-TX-007");
        });
    }

    // ------------------------------------------------------------ inbox ownership

    @Test
    void inboxIsScopedToTheCurrentUser() {
        service.notifyNewCriticalAlert(savedAlert(Severity.CRITICAL));
        Notification adminsNotification = repository.findAll().stream()
                .filter(n -> n.getRecipientId().equals(admin.getId())).findFirst().orElseThrow();

        TestAuth.loginAs(engineerNorth.getId(), engineerNorth.getName(), Role.ENGINEER);
        assertThat(inbox.list(null, null, PageRequest.of(0, 20)).totalElements()).isEqualTo(1);
        assertThat(inbox.unreadCount().count()).isEqualTo(1);
        assertThatThrownBy(() -> inbox.markRead(adminsNotification.getId())).isInstanceOf(NotFoundException.class);
        assertThat(repository.findById(adminsNotification.getId()).orElseThrow().isRead()).isFalse();

        TestAuth.loginAs(admin.getId(), admin.getName(), Role.ADMIN);
        NotificationDto read = inbox.markRead(adminsNotification.getId());
        assertThat(read.read()).isTrue();
        assertThat(read.readAt()).isNotNull();
        assertThat(inbox.unreadCount().count()).isZero();
        assertThat(inbox.list(false, null, PageRequest.of(0, 20)).totalElements()).isZero();
        assertThat(inbox.list(true, NotificationType.NEW_CRITICAL_ALERT, PageRequest.of(0, 20)).totalElements())
                .isEqualTo(1);

        TestAuth.loginAs(engineerNorth.getId(), engineerNorth.getName(), Role.ENGINEER);
        inbox.markAllRead();
        assertThat(inbox.unreadCount().count()).isZero();
        // Other users' notifications are untouched by read-all.
        assertThat(repository.countByRecipientIdAndReadFalse(operatorAll.getId())).isEqualTo(1);
    }

    // ------------------------------------------------------------ reminder job

    @Test
    void reminderJobNotifiesOverdueAndUpcomingTasksOnce() {
        Instant now = Instant.now();
        MaintenanceTask overdue = Fixtures.task(north, "Overdue inspection", MaintenanceStatus.IN_PROGRESS,
                Priority.HIGH, now.minus(Duration.ofDays(1)), now.minus(Duration.ofDays(5)));
        overdue.setAssignedTechnicianId(tech.getId());
        overdue.setCreatedById(engineerNorth.getId());
        overdue = taskRepository.save(overdue);

        MaintenanceTask upcoming = Fixtures.task(north, "Upcoming inspection", MaintenanceStatus.ASSIGNED,
                Priority.MEDIUM, now.plus(Duration.ofDays(2)), now);
        upcoming.setAssignedTechnicianId(tech.getId());
        upcoming = taskRepository.save(upcoming);

        MaintenanceTask farAway = Fixtures.task(north, "Later", MaintenanceStatus.ASSIGNED, Priority.LOW,
                now.plus(Duration.ofDays(10)), now);
        farAway.setAssignedTechnicianId(tech.getId());
        taskRepository.save(farAway);

        MaintenanceTask doneOverdue = Fixtures.task(north, "Done", MaintenanceStatus.COMPLETED, Priority.LOW,
                now.minus(Duration.ofDays(3)), now.minus(Duration.ofDays(6)));
        doneOverdue.setAssignedTechnicianId(tech.getId());
        taskRepository.save(doneOverdue);

        MaintenanceTask cancelledOverdue = Fixtures.task(north, "Cancelled", MaintenanceStatus.CANCELLED,
                Priority.LOW, now.minus(Duration.ofDays(3)), now.minus(Duration.ofDays(6)));
        taskRepository.save(cancelledOverdue);

        job.run();
        job.run();

        List<Notification> all = repository.findAll();
        assertThat(all).hasSize(3);
        String overdueId = overdue.getId();
        String upcomingId = upcoming.getId();
        assertThat(all.stream().filter(n -> n.getType() == NotificationType.MAINTENANCE_OVERDUE)
                .map(Notification::getRecipientId))
                .containsExactlyInAnyOrder(tech.getId(), engineerNorth.getId());
        assertThat(all.stream().filter(n -> n.getType() == NotificationType.MAINTENANCE_OVERDUE))
                .allSatisfy(n -> {
                    assertThat(n.getDedupKey()).isEqualTo("overdue:" + overdueId);
                    assertThat(n.getRelatedId()).isEqualTo(overdueId);
                });
        assertThat(all.stream().filter(n -> n.getType() == NotificationType.UPCOMING_INSPECTION))
                .singleElement().satisfies(n -> {
                    assertThat(n.getRecipientId()).isEqualTo(tech.getId());
                    assertThat(n.getDedupKey()).isEqualTo("upcoming:" + upcomingId);
                });
    }

    @Test
    void upcomingWindowFollowsSettings() {
        settings.getNotifications().setUpcomingInspectionDays(14);
        MaintenanceTask farAway = Fixtures.task(north, "Later", MaintenanceStatus.ASSIGNED, Priority.LOW,
                Instant.now().plus(Duration.ofDays(10)), Instant.now());
        farAway.setAssignedTechnicianId(tech.getId());
        taskRepository.save(farAway);

        job.checkAt(Instant.now());

        assertThat(recipientsOf(NotificationType.UPCOMING_INSPECTION)).containsExactly(tech.getId());
    }
}
