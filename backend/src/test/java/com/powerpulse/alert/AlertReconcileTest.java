package com.powerpulse.alert;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.normal;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.fault.FaultDetectionService;
import com.powerpulse.fault.FaultEvaluation;
import com.powerpulse.fault.FaultFinding;
import com.powerpulse.faulthistory.FaultIncidentService;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStateService;
import com.powerpulse.user.UserRepository;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;

/** Dedup / escalation / recovery / recurrence policy of {@link AlertService#reconcile}. */
class AlertReconcileTest {

    private InMemoryAlertRepository alerts;
    private FaultIncidentService incidents;
    private NotificationService notifications;
    private AuditService audit;
    private SystemSettings settings;
    private AlertService service;
    private final FaultDetectionService detector = new FaultDetectionService();
    private final Transformer t = transformer("t1", "PP-TX-001");

    @BeforeEach
    void setUp() {
        alerts = new InMemoryAlertRepository();
        incidents = mock(FaultIncidentService.class);
        notifications = mock(NotificationService.class);
        audit = mock(AuditService.class);
        settings = new SystemSettings();
        SettingsService settingsService = mock(SettingsService.class);
        when(settingsService.current()).thenReturn(settings);
        service = new AlertService(alerts.repo, mock(MongoTemplate.class), incidents, notifications, audit,
                mock(TransformerStateService.class), settingsService, mock(UserRepository.class),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private ReadingSnapshot temp(double c) {
        ReadingSnapshot r = normal();
        r.setTemperatureC(c);
        return r;
    }

    private void ingest(ReadingSnapshot r) {
        FaultEvaluation e = detector.evaluate(t, r, settings);
        service.reconcile(t, e, r);
    }

    private Alert onlyAlert(FaultType type) {
        List<Alert> matching = alerts.all().stream().filter(a -> a.getFaultType() == type).toList();
        assertThat(matching).hasSize(1);
        return matching.get(0);
    }

    @Test
    void findingWithoutActiveAlertCreatesNewAlertAndIncident() {
        ingest(temp(90));
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.getStatus()).isEqualTo(AlertStatus.NEW);
        assertThat(a.isActive()).isTrue();
        assertThat(a.getSeverity()).isEqualTo(Severity.MEDIUM);
        assertThat(a.getPeakSeverity()).isEqualTo(Severity.MEDIUM);
        assertThat(a.getIncidentKey()).isEqualTo("t1:OVERHEATING");
        assertThat(a.getTransformerCode()).isEqualTo("PP-TX-001");
        assertThat(a.getMeasuredValue()).isEqualTo(90.0);
        assertThat(a.getPeakValue()).isEqualTo(90.0);
        assertThat(a.getThreshold()).isEqualTo(85.0);
        assertThat(a.getUnit()).isEqualTo("°C");
        assertThat(a.getRecurrenceCount()).isZero();
        assertThat(a.getEvents()).extracting(AlertEvent::getType).containsExactly("CREATED");
        verify(incidents).openFor(any(Alert.class), any(ReadingSnapshot.class));
        verify(notifications, never()).notifyNewCriticalAlert(any());
    }

    @Test
    void criticalFindingNotifies() {
        ingest(temp(110));
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.getSeverity()).isEqualTo(Severity.CRITICAL);
        verify(notifications).notifyNewCriticalAlert(a);
    }

    @Test
    void repeatedFindingsKeepExactlyOneActiveAlert() {
        ingest(temp(90));
        ingest(temp(91));
        ingest(temp(89));
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(alerts.active()).hasSize(1);
        assertThat(a.getMeasuredValue()).isEqualTo(89.0);
        assertThat(a.getPeakValue()).isEqualTo(91.0);
        verify(incidents, times(1)).openFor(any(), any());
    }

    @Test
    void escalatesButNeverDeEscalates() {
        ingest(temp(90));   // MEDIUM
        ingest(temp(110));  // CRITICAL
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.getSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(a.getPeakSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(a.getThreshold()).isEqualTo(105.0);
        assertThat(a.getEvents()).extracting(AlertEvent::getType).containsExactly("CREATED", "ESCALATED");
        verify(notifications, times(1)).notifyNewCriticalAlert(any());
        verify(incidents).recordPeak(any(Alert.class), any(ReadingSnapshot.class));

        ingest(temp(88));   // back to MEDIUM range: still CRITICAL
        a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.getSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(a.getMeasuredValue()).isEqualTo(88.0);
        assertThat(a.getPeakValue()).isEqualTo(110.0);
        verify(notifications, times(1)).notifyNewCriticalAlert(any());
    }

    @Test
    void autoResolvesNewAlertAfterConfiguredNormalReadings() {
        ingest(temp(90));
        ingest(normal());
        ingest(normal());
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isActive()).isTrue();
        assertThat(a.getConsecutiveNormalCount()).isEqualTo(2);

        ingest(normal());
        a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isActive()).isFalse();
        assertThat(a.getStatus()).isEqualTo(AlertStatus.RESOLVED);
        assertThat(a.getResolvedBy()).isEqualTo("system");
        assertThat(a.getResolutionNotes()).isEqualTo("Auto-resolved: 3 consecutive readings within normal range.");
        assertThat(a.getResolvedAt()).isEqualTo(NOW);
        verify(incidents).finalizeFor(a);
        verify(notifications).notifyIncidentResolved(a);
    }

    @Test
    void recoveryCountResetsWhenTheFaultReturns() {
        settings.setRecoveryReadings(2);
        ingest(temp(90));
        ingest(normal());
        ingest(temp(90));
        ingest(normal());
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isActive()).isTrue();
        assertThat(a.getConsecutiveNormalCount()).isEqualTo(1);
        ingest(normal());
        assertThat(onlyAlert(FaultType.OVERHEATING).isActive()).isFalse();
    }

    @Test
    void acknowledgedAlertIsFlaggedRecoveredAndLeftOpen() {
        ingest(temp(90));
        Alert a = onlyAlert(FaultType.OVERHEATING);
        a.setStatus(AlertStatus.ACKNOWLEDGED);
        for (int i = 0; i < 5; i++) {
            ingest(normal());
        }
        a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isActive()).isTrue();
        assertThat(a.getStatus()).isEqualTo(AlertStatus.ACKNOWLEDGED);
        assertThat(a.isRecovered()).isTrue();
        assertThat(a.getRecoveredAt()).isEqualTo(NOW);
        assertThat(a.getEvents()).filteredOn(e -> e.getType().equals("RECOVERED")).hasSize(1);
        verify(incidents, never()).finalizeFor(any());

        // the fault returns: recovered flag is cleared
        ingest(temp(92));
        a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isRecovered()).isFalse();
        assertThat(a.getRecoveredAt()).isNull();
        assertThat(a.getConsecutiveNormalCount()).isZero();
    }

    @Test
    void inProgressAlertIsAlsoOnlyFlaggedRecovered() {
        ingest(temp(90));
        onlyAlert(FaultType.OVERHEATING).setStatus(AlertStatus.IN_PROGRESS);
        ingest(normal());
        ingest(normal());
        ingest(normal());
        Alert a = onlyAlert(FaultType.OVERHEATING);
        assertThat(a.isActive()).isTrue();
        assertThat(a.isRecovered()).isTrue();
    }

    @Test
    void recurrenceCreatesNewAlertWithIncrementedCount() {
        settings.setRecoveryReadings(1);
        ingest(temp(90));
        ingest(normal());   // auto-resolved
        ingest(temp(90));   // recurrence #1
        ingest(normal());
        ingest(temp(95));   // recurrence #2
        List<Alert> all = alerts.all().stream().filter(a -> a.getFaultType() == FaultType.OVERHEATING).toList();
        assertThat(all).hasSize(3);
        assertThat(all).extracting(Alert::getRecurrenceCount).containsExactly(0, 1, 2);
        assertThat(alerts.active()).hasSize(1);
        assertThat(alerts.active().get(0).getRecurrenceCount()).isEqualTo(2);
        verify(incidents, times(3)).openFor(any(), any());
    }

    @Test
    void duplicateKeyOnInsertReReadsTheActiveAlertAndContinues() {
        // Another execution creates the alert between our read and our insert.
        Alert concurrent = com.powerpulse.TestData.alert("other", "t1", FaultType.OVERHEATING, Severity.MEDIUM,
                AlertStatus.NEW);
        concurrent.setMeasuredValue(86.0);
        concurrent.setPeakValue(86.0);
        when(alerts.repo.findByTransformerIdAndActiveTrue("t1")).thenReturn(List.of());
        doAnswer(inv -> {
            alerts.store.put("other", concurrent);
            throw new DuplicateKeyException("E11000");
        }).when(alerts.repo).insert(any(Alert.class));

        ingest(temp(110));

        assertThat(alerts.store).hasSize(1);
        Alert a = alerts.store.get("other");
        assertThat(a.getSeverity()).isEqualTo(Severity.CRITICAL); // escalated on the existing alert
        assertThat(a.getMeasuredValue()).isEqualTo(110.0);
        verify(incidents, never()).openFor(any(), any());
        verify(notifications).notifyNewCriticalAlert(a);
    }

    @Test
    void sensorFailureDoesNotCountAsRecoveryForTheInvalidMetric() {
        ingest(temp(90));
        ReadingSnapshot broken = normal();
        broken.setTemperatureC(null);
        for (int i = 0; i < 5; i++) {
            ingest(broken);
        }
        Alert overheating = onlyAlert(FaultType.OVERHEATING);
        assertThat(overheating.isActive()).isTrue();
        assertThat(overheating.getConsecutiveNormalCount()).isZero();
        assertThat(onlyAlert(FaultType.SENSOR_FAILURE).isActive()).isTrue();
    }

    @Test
    void staleAlertOpensOnceAndRecoversWhenFreshReadingsArrive() {
        FaultFinding stale = new FaultFinding(FaultType.STALE_READING, Severity.HIGH, 200.0, 120.0, "s",
                "No reading received for 200 s");
        AlertService.AlertOutcome first = service.reconcileStale(t, stale);
        AlertService.AlertOutcome second = service.reconcileStale(t, new FaultFinding(FaultType.STALE_READING,
                Severity.HIGH, 230.0, 120.0, "s", "No reading received for 230 s"));
        assertThat(first.created()).isTrue();
        assertThat(second.created()).isFalse();
        Alert a = onlyAlert(FaultType.STALE_READING);
        assertThat(a.getMeasuredValue()).isEqualTo(230.0);
        assertThat(a.getUnit()).isEqualTo("s");

        ingest(normal());
        ingest(normal());
        assertThat(onlyAlert(FaultType.STALE_READING).isActive()).isTrue();
        ingest(normal());
        a = onlyAlert(FaultType.STALE_READING);
        assertThat(a.isActive()).isFalse();
        assertThat(a.getResolvedBy()).isEqualTo("system");
    }
}
