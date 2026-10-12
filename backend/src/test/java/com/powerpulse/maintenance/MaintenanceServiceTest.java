package com.powerpulse.maintenance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertLinkService;
import com.powerpulse.alert.AlertRepository;
import com.powerpulse.audit.AuditLog;
import com.powerpulse.audit.AuditServiceImpl;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.ForbiddenException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.notification.NotificationService;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@MongoWorkflowTest
@Import({MaintenanceService.class, AuditServiceImpl.class})
class MaintenanceServiceTest {

    @Autowired MaintenanceService service;
    @Autowired MongoTemplate mongoTemplate;
    @Autowired TransformerRepository transformerRepository;
    @Autowired UserRepository userRepository;
    @Autowired AlertRepository alertRepository;
    @Autowired MaintenanceTaskRepository taskRepository;

    @MockitoBean AlertLinkService alertLinkService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean SettingsService settingsService;

    Transformer transformer;
    User tech;
    User tech2;
    User inactiveTech;
    User operatorUser;

    @BeforeEach
    void setUp() {
        Fixtures.clean(mongoTemplate);
        when(settingsService.current()).thenReturn(new SystemSettings());
        transformer = transformerRepository.save(
                Fixtures.transformer("PP-TX-001", "North Ridge", TransformerStatus.HEALTHY, 90, 500, 50.0));
        tech = userRepository.save(Fixtures.user("Tess Tech", Role.TECHNICIAN, null, true));
        tech2 = userRepository.save(Fixtures.user("Tom Tech", Role.TECHNICIAN, null, true));
        inactiveTech = userRepository.save(Fixtures.user("Old Tech", Role.TECHNICIAN, null, false));
        operatorUser = userRepository.save(Fixtures.user("Opal Operator", Role.OPERATOR, null, true));
        loginAs("eng-1", "Erin Engineer", Role.ENGINEER);
    }

    @AfterEach
    void tearDown() {
        TestAuth.logout();
    }

    private static void loginAs(String id, String name, Role role) {
        TestAuth.loginAs(id, name, role);
    }

    private void loginAsTech(User user) {
        TestAuth.loginAs(user.getId(), user.getName(), Role.TECHNICIAN);
    }

    private MaintenanceCreateRequest createReq(String technicianId) {
        return new MaintenanceCreateRequest(transformer.getId(), null, "Inspect cooling fans", "Fans noisy",
                Priority.HIGH, technicianId, Instant.now().plus(Duration.ofDays(2)));
    }

    private static MaintenanceUpdateRequest status(MaintenanceStatus status, String cancelReason) {
        return new MaintenanceUpdateRequest(null, null, null, null, null, status, null, null, null, cancelReason);
    }

    private static MaintenanceUpdateRequest priority(Priority p) {
        return new MaintenanceUpdateRequest(null, null, p, null, null, null, null, null, null, null);
    }

    private static MaintenanceUpdateRequest note(String text) {
        return new MaintenanceUpdateRequest(null, null, null, null, null, null, null, text, null, null);
    }

    // ------------------------------------------------------------ create

    @Test
    void createWithoutTechnicianIsPendingWithDenormalizedFieldsHistoryAndAudit() {
        MaintenanceDto dto = service.create(createReq(null));

        assertThat(dto.status()).isEqualTo(MaintenanceStatus.PENDING);
        assertThat(dto.transformerCode()).isEqualTo("PP-TX-001");
        assertThat(dto.transformerName()).isEqualTo("Transformer PP-TX-001");
        assertThat(dto.location()).isEqualTo("North Ridge");
        assertThat(dto.createdById()).isEqualTo("eng-1");
        assertThat(dto.createdByName()).isEqualTo("Erin Engineer");
        assertThat(dto.history()).extracting(MaintenanceDto.TaskHistoryEntryDto::action).containsExactly("CREATED");
        assertThat(dto.overdue()).isFalse();
        verify(notificationService, never()).notifyMaintenanceAssigned(any());

        List<AuditLog> audit = mongoTemplate.findAll(AuditLog.class);
        assertThat(audit).hasSize(1);
        assertThat(audit.get(0).getAction()).isEqualTo("MAINTENANCE_CREATED");
        assertThat(audit.get(0).getActorName()).isEqualTo("Erin Engineer");
        assertThat(audit.get(0).getEntityId()).isEqualTo(dto.id());
    }

    @Test
    void createWithTechnicianIsAssignedAndNotifies() {
        MaintenanceDto dto = service.create(createReq(tech.getId()));

        assertThat(dto.status()).isEqualTo(MaintenanceStatus.ASSIGNED);
        assertThat(dto.assignedTechnicianName()).isEqualTo("Tess Tech");
        assertThat(dto.history()).extracting(MaintenanceDto.TaskHistoryEntryDto::action)
                .containsExactly("CREATED", "ASSIGNED");
        verify(notificationService).notifyMaintenanceAssigned(any(MaintenanceTask.class));
    }

    @Test
    void createRejectsInvalidTechnicianDueDateAndUnknownTransformer() {
        assertThatThrownBy(() -> service.create(createReq(inactiveTech.getId()))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(createReq(operatorUser.getId()))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(createReq("missing-user"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(new MaintenanceCreateRequest(transformer.getId(), null, "T", null,
                Priority.LOW, null, Instant.now().minus(Duration.ofDays(2))))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(new MaintenanceCreateRequest("nope", null, "T", null,
                Priority.LOW, null, Instant.now().plus(Duration.ofDays(1))))).isInstanceOf(NotFoundException.class);
        // A due date a few hours in the past is tolerated.
        assertThat(service.create(new MaintenanceCreateRequest(transformer.getId(), null, "T", null, Priority.LOW,
                null, Instant.now().minus(Duration.ofHours(3)))).overdue()).isTrue();
        assertThat(taskRepository.count()).isEqualTo(1);
    }

    @Test
    void createFromAlertLinksTheAlert() {
        Alert alert = alertRepository.save(Fixtures.alert(transformer, FaultType.OVERHEATING, Severity.HIGH, true,
                Instant.now()));
        MaintenanceDto dto = service.create(new MaintenanceCreateRequest(transformer.getId(), alert.getId(),
                "Check radiators", null, Priority.URGENT, null, Instant.now().plus(Duration.ofDays(1))));

        assertThat(dto.alertId()).isEqualTo(alert.getId());
        verify(alertLinkService).linkMaintenance(alert.getId(), dto.id());
        assertThatThrownBy(() -> service.create(new MaintenanceCreateRequest(transformer.getId(), "missing-alert",
                "X", null, Priority.LOW, null, Instant.now().plus(Duration.ofDays(1)))))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void onlyManagersCanCreate() {
        loginAsTech(tech);
        assertThatThrownBy(() -> service.create(createReq(null))).isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------ lifecycle

    @Test
    void fullLifecycleCompletesAndUpdatesTransformerLastMaintenanceWithFieldScopedUpdate() {
        MaintenanceDto created = service.create(createReq(tech.getId()));
        Long versionBefore = transformerRepository.findById(transformer.getId()).orElseThrow().getVersion();

        loginAsTech(tech);
        MaintenanceDto started = service.update(created.id(), status(MaintenanceStatus.IN_PROGRESS, null));
        assertThat(started.status()).isEqualTo(MaintenanceStatus.IN_PROGRESS);

        MaintenanceDto withNotes = service.update(created.id(), new MaintenanceUpdateRequest(null, null, null, null,
                null, null, "Fan bearing worn", "Replaced bearing",
                new MaintenanceUpdateRequest.PartInput("Fan bearing", 2, "SKF"), null));
        assertThat(withNotes.inspectionFindings()).isEqualTo("Fan bearing worn");
        assertThat(withNotes.workNotes()).singleElement().satisfies(n -> {
            assertThat(n.text()).isEqualTo("Replaced bearing");
            assertThat(n.authorName()).isEqualTo("Tess Tech");
        });
        assertThat(withNotes.partsReplaced()).singleElement().satisfies(p -> assertThat(p.quantity()).isEqualTo(2));

        MaintenanceDto done = service.complete(created.id(), new MaintenanceCompleteRequest(null, "All good"));
        assertThat(done.status()).isEqualTo(MaintenanceStatus.COMPLETED);
        assertThat(done.completedAt()).isNotNull();
        assertThat(done.workNotes()).hasSize(2);
        assertThat(done.history()).extracting(MaintenanceDto.TaskHistoryEntryDto::action)
                .contains("CREATED", "ASSIGNED", "STARTED", "FINDINGS_UPDATED", "WORK_NOTE_ADDED", "PART_ADDED",
                        "COMPLETED");

        Transformer after = transformerRepository.findById(transformer.getId()).orElseThrow();
        assertThat(after.getLastMaintenanceAt()).isNotNull();
        assertThat(after.getLastMaintenanceAt().truncatedTo(ChronoUnit.MILLIS))
                .isEqualTo(done.completedAt().truncatedTo(ChronoUnit.MILLIS));
        assertThat(after.getVersion()).isEqualTo(versionBefore + 1);
        assertThat(after.getHealthScore()).isEqualTo(90);
        assertThat(after.getLatestReading()).isNotNull();

        assertThat(mongoTemplate.findAll(AuditLog.class)).extracting(AuditLog::getAction)
                .contains("MAINTENANCE_CREATED", "MAINTENANCE_STARTED", "MAINTENANCE_UPDATED", "MAINTENANCE_COMPLETED");
    }

    @Test
    void illegalTransitionsReturnConflict() {
        MaintenanceDto pending = service.create(createReq(null));
        assertThatThrownBy(() -> service.update(pending.id(), status(MaintenanceStatus.IN_PROGRESS, null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.update(pending.id(), status(MaintenanceStatus.COMPLETED, null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.complete(pending.id(), null)).isInstanceOf(ConflictException.class);

        MaintenanceDto assigned = service.create(createReq(tech.getId()));
        assertThatThrownBy(() -> service.update(assigned.id(), status(MaintenanceStatus.PENDING, null)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.complete(assigned.id(), null)).isInstanceOf(ConflictException.class);
    }

    @Test
    void assigningAPendingTaskMovesItToAssignedAndNotifies() {
        MaintenanceDto pending = service.create(createReq(null));
        MaintenanceDto assigned = service.update(pending.id(), new MaintenanceUpdateRequest(null, null, null, null,
                tech.getId(), null, null, null, null, null));
        assertThat(assigned.status()).isEqualTo(MaintenanceStatus.ASSIGNED);
        assertThat(assigned.assignedTechnicianId()).isEqualTo(tech.getId());
        verify(notificationService, times(1)).notifyMaintenanceAssigned(any());

        assertThatThrownBy(() -> service.update(pending.id(), new MaintenanceUpdateRequest(null, null, null, null,
                operatorUser.getId(), null, null, null, null, null))).isInstanceOf(BadRequestException.class);
    }

    @Test
    void cancelRequiresReasonAndCancelledTasksAreImmutable() {
        MaintenanceDto task = service.create(createReq(tech.getId()));
        assertThatThrownBy(() -> service.update(task.id(), status(MaintenanceStatus.CANCELLED, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.update(task.id(), status(MaintenanceStatus.CANCELLED, "  ")))
                .isInstanceOf(BadRequestException.class);

        MaintenanceDto cancelled = service.update(task.id(), status(MaintenanceStatus.CANCELLED, "Duplicate task"));
        assertThat(cancelled.status()).isEqualTo(MaintenanceStatus.CANCELLED);
        assertThat(cancelled.cancelReason()).isEqualTo("Duplicate task");
        assertThat(cancelled.cancelledAt()).isNotNull();

        assertThatThrownBy(() -> service.update(task.id(), priority(Priority.LOW))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.update(task.id(), note("late note"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.complete(task.id(), null)).isInstanceOf(ConflictException.class);
        assertThat(taskRepository.findById(task.id())).isPresent();
    }

    @Test
    void completedTasksAreImmutable() {
        MaintenanceDto task = service.create(createReq(tech.getId()));
        service.update(task.id(), status(MaintenanceStatus.IN_PROGRESS, null));
        service.complete(task.id(), new MaintenanceCompleteRequest("ok", null));

        assertThatThrownBy(() -> service.update(task.id(), note("after"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.update(task.id(), status(MaintenanceStatus.CANCELLED, "oops")))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.complete(task.id(), null)).isInstanceOf(ConflictException.class);
        MaintenanceTask stored = taskRepository.findById(task.id()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(MaintenanceStatus.COMPLETED);
        assertThat(stored.getInspectionFindings()).isEqualTo("ok");
    }

    // ------------------------------------------------------------ technician scoping

    @Test
    void technicianListIsForcedToOwnTasks() {
        service.create(createReq(tech.getId()));
        service.create(createReq(tech.getId()));
        service.create(createReq(tech2.getId()));
        service.create(createReq(null));

        loginAsTech(tech);
        PageResponse<MaintenanceDto> own = service.list(null, null, null, tech2.getId(), null, null, null,
                PageRequest.of(0, 20));
        assertThat(own.totalElements()).isEqualTo(2);
        assertThat(own.content()).allMatch(t -> t.assignedTechnicianId().equals(tech.getId()));

        loginAs("eng-1", "Erin Engineer", Role.ENGINEER);
        assertThat(service.list(null, null, null, null, null, null, null, PageRequest.of(0, 20)).totalElements())
                .isEqualTo(4);
        assertThat(service.list(null, null, null, tech2.getId(), null, null, null, PageRequest.of(0, 20))
                .totalElements()).isEqualTo(1);
    }

    @Test
    void technicianCannotReadOrModifyOthersTasksOrManagerFields() {
        MaintenanceDto others = service.create(createReq(tech2.getId()));
        MaintenanceDto own = service.create(createReq(tech.getId()));

        loginAsTech(tech);
        assertThatThrownBy(() -> service.get(others.id())).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update(others.id(), note("hi"))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.complete(others.id(), null)).isInstanceOf(ForbiddenException.class);
        assertThat(service.get(own.id()).id()).isEqualTo(own.id());

        assertThatThrownBy(() -> service.update(own.id(), priority(Priority.LOW))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update(own.id(), status(MaintenanceStatus.CANCELLED, "no")))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.update(own.id(), new MaintenanceUpdateRequest(null, null, null,
                Instant.now().plus(Duration.ofDays(9)), null, null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThat(taskRepository.findById(own.id()).orElseThrow().getPriority()).isEqualTo(Priority.HIGH);

        assertThat(service.forTransformer(transformer.getId())).extracting(MaintenanceDto::id).containsExactly(own.id());
    }

    @Test
    void operatorCannotModifyTasks() {
        MaintenanceDto task = service.create(createReq(tech.getId()));
        loginAs(operatorUser.getId(), "Opal Operator", Role.OPERATOR);
        assertThatThrownBy(() -> service.update(task.id(), note("x"))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.complete(task.id(), null)).isInstanceOf(ForbiddenException.class);
        assertThat(service.get(task.id()).id()).isEqualTo(task.id());
    }

    // ------------------------------------------------------------ list filters

    @Test
    void overdueUpcomingSearchAndPrioritySortFilters() {
        Instant now = Instant.now();
        MaintenanceTask overdue = taskRepository.save(Fixtures.task(transformer, "Overdue oil check",
                MaintenanceStatus.ASSIGNED, Priority.LOW, now.minus(Duration.ofDays(2)), now));
        taskRepository.save(Fixtures.task(transformer, "Overdue but done", MaintenanceStatus.COMPLETED,
                Priority.URGENT, now.minus(Duration.ofDays(2)), now));
        MaintenanceTask upcoming = taskRepository.save(Fixtures.task(transformer, "Upcoming bushing check",
                MaintenanceStatus.PENDING, Priority.URGENT, now.plus(Duration.ofDays(1)), now));
        taskRepository.save(Fixtures.task(transformer, "Far future", MaintenanceStatus.PENDING, Priority.MEDIUM,
                now.plus(Duration.ofDays(20)), now));

        assertThat(service.list(null, null, null, null, null, true, null, PageRequest.of(0, 20)).content())
                .extracting(MaintenanceDto::id).containsExactly(overdue.getId());
        assertThat(service.list(null, null, null, null, null, null, true, PageRequest.of(0, 20)).content())
                .extracting(MaintenanceDto::id).containsExactly(upcoming.getId());
        assertThat(service.list("BUSHING", null, null, null, null, null, null, PageRequest.of(0, 20)).content())
                .extracting(MaintenanceDto::id).containsExactly(upcoming.getId());
        assertThat(service.list("pp-tx", null, null, null, null, null, null, PageRequest.of(0, 20)).totalElements())
                .isEqualTo(4);
        // Regex metacharacters are treated literally.
        assertThat(service.list(".*", null, null, null, null, null, null, PageRequest.of(0, 20)).totalElements())
                .isZero();

        List<Priority> byPriority = service.list(null, null, null, null, null, null, null,
                        PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "priority"))).content().stream()
                .map(MaintenanceDto::priority).toList();
        assertThat(byPriority).containsExactly(Priority.URGENT, Priority.URGENT, Priority.MEDIUM, Priority.LOW);
        assertThat(service.list(null, null, Priority.URGENT, null, null, null, null, PageRequest.of(0, 1)))
                .satisfies(p -> {
                    assertThat(p.totalElements()).isEqualTo(2);
                    assertThat(p.totalPages()).isEqualTo(2);
                    assertThat(p.content()).hasSize(1);
                });
    }

    @Test
    void getUnknownTaskIsNotFound() {
        assertThatThrownBy(() -> service.get("missing")).isInstanceOf(NotFoundException.class);
        verify(alertLinkService, never()).linkMaintenance(eq("x"), any());
    }
}
