package com.powerpulse.alert;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.alert;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.alert.AlertRequests.AlertAssignRequest;
import com.powerpulse.alert.AlertRequests.AlertResolveRequest;
import com.powerpulse.alert.AlertRequests.AlertUpdateRequest;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.faulthistory.FaultIncidentService;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.security.AuthenticatedUser;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.TransformerStateService;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class AlertWorkflowTest {

    private InMemoryAlertRepository alerts;
    private FaultIncidentService incidents;
    private NotificationService notifications;
    private AuditService audit;
    private TransformerStateService state;
    private UserRepository users;
    private AlertService service;

    @BeforeEach
    void setUp() {
        alerts = new InMemoryAlertRepository();
        incidents = mock(FaultIncidentService.class);
        notifications = mock(NotificationService.class);
        audit = mock(AuditService.class);
        state = mock(TransformerStateService.class);
        users = mock(UserRepository.class);
        SettingsService settings = mock(SettingsService.class);
        when(settings.current()).thenReturn(new SystemSettings());
        service = new AlertService(alerts.repo, mock(MongoTemplate.class), incidents, notifications, audit, state,
                settings, users, Clock.fixed(NOW, ZoneOffset.UTC));
        AuthenticatedUser principal = new AuthenticatedUser("u-eng", "Erin Engineer", "eng@x", Role.ENGINEER, null);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private Alert stored(AlertStatus status) {
        Alert a = alert("a1", "t1", FaultType.OVERHEATING, Severity.HIGH, status);
        alerts.store.put("a1", a);
        return a;
    }

    @Test
    void acknowledgeNewAlert() {
        stored(AlertStatus.NEW);
        AlertDto dto = service.acknowledge("a1");
        assertThat(dto.status()).isEqualTo(AlertStatus.ACKNOWLEDGED);
        assertThat(dto.acknowledgedBy()).isEqualTo("Erin Engineer");
        assertThat(dto.acknowledgedAt()).isEqualTo(NOW);
        assertThat(dto.events()).extracting(AlertDto.AlertEventDto::type).containsExactly("ACKNOWLEDGED");
        assertThat(dto.events().get(0).actor()).isEqualTo("Erin Engineer");
        verify(state).refresh("t1");
        verify(audit).record(eq("ALERT_ACKNOWLEDGED"), eq(ResourceType.ALERT), eq("a1"), anyString());
    }

    @Test
    void acknowledgeNonNewIs409() {
        stored(AlertStatus.ACKNOWLEDGED);
        assertThatThrownBy(() -> service.acknowledge("a1")).isInstanceOf(ConflictException.class);
        verify(state, never()).refresh(anyString());
    }

    @Test
    void unknownAlertIs404() {
        assertThatThrownBy(() -> service.acknowledge("nope")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void statusMovesForwardOnly() {
        stored(AlertStatus.NEW);
        assertThat(service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.ACKNOWLEDGED)).status())
                .isEqualTo(AlertStatus.ACKNOWLEDGED);
        AlertDto inProgress = service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.IN_PROGRESS));
        assertThat(inProgress.status()).isEqualTo(AlertStatus.IN_PROGRESS);
        assertThat(inProgress.events()).extracting(AlertDto.AlertEventDto::type)
                .containsExactly("STATUS_CHANGED", "STATUS_CHANGED");

        assertThatThrownBy(() -> service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.ACKNOWLEDGED)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.IN_PROGRESS)))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.NEW)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void resolvedViaPatchIs409() {
        stored(AlertStatus.IN_PROGRESS);
        assertThatThrownBy(() -> service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.RESOLVED)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void skippingToInProgressSetsAcknowledgement() {
        stored(AlertStatus.NEW);
        AlertDto dto = service.updateStatus("a1", new AlertUpdateRequest(AlertStatus.IN_PROGRESS));
        assertThat(dto.acknowledgedAt()).isEqualTo(NOW);
    }

    @Test
    void assignToActiveUserAcknowledgesNewAlert() {
        stored(AlertStatus.NEW);
        User tech = new User();
        tech.setId("u-tech");
        tech.setName("Tara Tech");
        tech.setActive(true);
        when(users.findById("u-tech")).thenReturn(Optional.of(tech));
        AlertDto dto = service.assign("a1", new AlertAssignRequest("u-tech"));
        assertThat(dto.assignedUserId()).isEqualTo("u-tech");
        assertThat(dto.assignedUserName()).isEqualTo("Tara Tech");
        assertThat(dto.status()).isEqualTo(AlertStatus.ACKNOWLEDGED);
        assertThat(dto.events()).extracting(AlertDto.AlertEventDto::type).contains("ASSIGNED", "ACKNOWLEDGED");
    }

    @Test
    void assignToMissingOrInactiveUserIs400() {
        stored(AlertStatus.NEW);
        User inactive = new User();
        inactive.setId("u-old");
        inactive.setActive(false);
        when(users.findById("u-old")).thenReturn(Optional.of(inactive));
        when(users.findById("u-none")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.assign("a1", new AlertAssignRequest("u-old")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.assign("a1", new AlertAssignRequest("u-none")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void resolveFinalizesIncidentNotifiesAndAudits() {
        stored(AlertStatus.IN_PROGRESS);
        AlertDto dto = service.resolve("a1", new AlertResolveRequest("  Replaced cooling fan  "));
        assertThat(dto.status()).isEqualTo(AlertStatus.RESOLVED);
        assertThat(dto.active()).isFalse();
        assertThat(dto.resolvedBy()).isEqualTo("Erin Engineer");
        assertThat(dto.resolutionNotes()).isEqualTo("Replaced cooling fan");
        assertThat(dto.resolvedAt()).isEqualTo(NOW);
        verify(incidents).finalizeFor(any(Alert.class));
        verify(notifications).notifyIncidentResolved(any(Alert.class));
        verify(audit).record(eq("ALERT_RESOLVED"), eq(ResourceType.ALERT), eq("a1"), anyString());
        verify(state).refresh("t1");
    }

    @Test
    void resolveTwiceIs409AndShortNotesAre400() {
        stored(AlertStatus.NEW);
        assertThatThrownBy(() -> service.resolve("a1", new AlertResolveRequest("ok   ")))
                .isInstanceOf(BadRequestException.class);
        service.resolve("a1", new AlertResolveRequest("Fixed it."));
        assertThatThrownBy(() -> service.resolve("a1", new AlertResolveRequest("Fixed again")))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.acknowledge("a1")).isInstanceOf(ConflictException.class);
    }

    @Test
    void optimisticLockConflictIsRetriedOnFreshState() {
        Alert a = stored(AlertStatus.NEW);
        when(alerts.repo.save(any(Alert.class)))
                .thenThrow(new OptimisticLockingFailureException("conflict"))
                .thenAnswer(inv -> inv.getArgument(0));
        // fresh copy returned on retry
        Alert fresh = alert("a1", "t1", FaultType.OVERHEATING, Severity.HIGH, AlertStatus.NEW);
        when(alerts.repo.findById("a1")).thenReturn(Optional.of(a), Optional.of(fresh));
        AlertDto dto = service.acknowledge("a1");
        assertThat(dto.status()).isEqualTo(AlertStatus.ACKNOWLEDGED);
        assertThat(fresh.getStatus()).isEqualTo(AlertStatus.ACKNOWLEDGED);
    }

    @Test
    void linkMaintenanceIsIdempotent() {
        stored(AlertStatus.ACKNOWLEDGED);
        service.linkMaintenance("a1", "m1");
        Alert a = service.linkMaintenance("a1", "m1");
        assertThat(a.getMaintenanceIds()).containsExactly("m1");
        assertThat(a.getEvents()).filteredOn(e -> e.getType().equals("MAINTENANCE_LINKED")).hasSize(1);
        verify(incidents, org.mockito.Mockito.times(2)).linkMaintenance("a1", "m1");
    }
}
