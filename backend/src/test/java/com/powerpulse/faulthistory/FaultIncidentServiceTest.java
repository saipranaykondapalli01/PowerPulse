package com.powerpulse.faulthistory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertEvent;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.MaintenanceTaskRepository;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.support.Fixtures;
import com.powerpulse.support.MongoWorkflowTest;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;

@MongoWorkflowTest
@Import({FaultIncidentServiceImpl.class, FaultHistoryService.class})
class FaultIncidentServiceTest {

    @Autowired FaultIncidentServiceImpl service;
    @Autowired FaultHistoryService historyService;
    @Autowired FaultIncidentRepository repository;
    @Autowired TransformerRepository transformerRepository;
    @Autowired MaintenanceTaskRepository taskRepository;
    @Autowired MongoTemplate mongoTemplate;

    Transformer transformer;
    Alert alert;

    @BeforeEach
    void setUp() {
        Fixtures.clean(mongoTemplate);
        transformer = transformerRepository.save(
                Fixtures.transformer("PP-TX-003", "Eastfield", TransformerStatus.WARNING, 70, 400, 60.0));
        alert = Fixtures.alert(transformer, FaultType.OVERHEATING, Severity.MEDIUM, true,
                Instant.now().minus(Duration.ofMinutes(30)).truncatedTo(ChronoUnit.MILLIS));
        alert.setId("alert-1");
    }

    private AlertEvent event(String type, String actor, String message) {
        AlertEvent e = new AlertEvent();
        e.setAt(Instant.now());
        e.setType(type);
        e.setActor(actor);
        e.setMessage(message);
        return e;
    }

    @Test
    void openIsIdempotent() {
        service.openFor(alert, Fixtures.snapshot(Instant.now(), 88.0, 60.0));
        service.openFor(alert, Fixtures.snapshot(Instant.now(), 89.0, 60.0));

        List<FaultIncident> all = repository.findAll();
        assertThat(all).hasSize(1);
        FaultIncident incident = all.get(0);
        assertThat(incident.getAlertId()).isEqualTo("alert-1");
        assertThat(incident.getTransformerCode()).isEqualTo("PP-TX-003");
        assertThat(incident.getStartedAt()).isEqualTo(alert.getCreatedAt());
        assertThat(incident.getReadings()).hasSize(1);
        assertThat(incident.getReadings().get(0).getTemperatureC()).isEqualTo(88.0);
    }

    @Test
    void concurrentOpenersCreateExactlyOneIncident() throws Exception {
        int threads = 8;
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        List<java.util.concurrent.Future<?>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                service.openFor(alert, null);
                return null;
            }));
        }
        start.countDown();
        for (java.util.concurrent.Future<?> f : futures) {
            f.get(); // rethrows if any opener failed (e.g. an unswallowed DuplicateKeyException)
        }
        pool.shutdown();
        assertThat(repository.count()).isEqualTo(1);

        // The unique index is what guarantees this.
        FaultIncident duplicate = new FaultIncident();
        duplicate.setAlertId("alert-1");
        assertThatThrownBy(() -> repository.insert(duplicate))
                .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
    }

    @Test
    void recordPeakUpdatesPeakAndCapsReadingsKeepingTheOpeningOne() {
        service.openFor(alert, Fixtures.snapshot(Instant.now(), 86.0, 60.0));
        for (int i = 0; i < 15; i++) {
            alert.setPeakValue(90.0 + i);
            alert.setPeakSeverity(i > 10 ? Severity.CRITICAL : Severity.HIGH);
            service.recordPeak(alert, Fixtures.snapshot(Instant.now(), 90.0 + i, 60.0));
        }
        FaultIncident incident = repository.findByAlertId("alert-1").orElseThrow();
        assertThat(incident.getReadings()).hasSize(FaultIncidentServiceImpl.MAX_READINGS);
        assertThat(incident.getReadings().get(0).getTemperatureC()).isEqualTo(86.0);
        assertThat(incident.getReadings().get(incident.getReadings().size() - 1).getTemperatureC()).isEqualTo(104.0);
        assertThat(incident.getPeakValue()).isEqualTo(104.0);
        assertThat(incident.getSeverity()).isEqualTo(Severity.CRITICAL);
    }

    @Test
    void finalizeComputesDurationNotesAndActions() {
        service.openFor(alert, null);
        MaintenanceTask task = taskRepository.save(Fixtures.task(transformer, "Clean radiator fins",
                MaintenanceStatus.COMPLETED, Priority.HIGH, Instant.now(), Instant.now()));
        service.linkMaintenance("alert-1", task.getId());
        service.linkMaintenance("alert-1", task.getId());

        Instant resolvedAt = alert.getCreatedAt().plus(Duration.ofSeconds(1234));
        alert.setStatus(AlertStatus.RESOLVED);
        alert.setActive(false);
        alert.setResolvedAt(resolvedAt);
        alert.setResolvedBy("Erin Engineer");
        alert.setResolutionNotes("Fans replaced");
        alert.setPeakSeverity(Severity.HIGH);
        alert.setMaintenanceIds(List.of(task.getId()));
        alert.setEvents(List.of(
                event("CREATED", "system", "Opened"),
                event("ACKNOWLEDGED", "Opal Operator", null),
                event("ASSIGNED", "Opal Operator", "Assigned to Erin Engineer"),
                event("MAINTENANCE_LINKED", "Erin Engineer", task.getId()),
                event("RESOLVED", "Erin Engineer", "Fans replaced")));

        service.finalizeFor(alert);
        service.finalizeFor(alert);

        FaultIncident incident = repository.findByAlertId("alert-1").orElseThrow();
        assertThat(incident.getDurationSeconds()).isEqualTo(1234L);
        assertThat(incident.getResolvedAt()).isEqualTo(resolvedAt);
        assertThat(incident.getResolutionNotes()).isEqualTo("Fans replaced");
        assertThat(incident.getSeverity()).isEqualTo(Severity.HIGH);
        assertThat(incident.getMaintenanceIds()).containsExactly(task.getId());
        assertThat(incident.getActionsTaken()).hasSize(4);
        assertThat(incident.getActionsTaken().get(0)).startsWith("Acknowledged by Opal Operator");
        assertThat(incident.getActionsTaken().get(1)).startsWith("Assigned by Opal Operator");
        assertThat(incident.getActionsTaken().get(2)).startsWith("Resolved by Erin Engineer");
        assertThat(incident.getActionsTaken().get(3)).isEqualTo("Maintenance task \"Clean radiator fins\" (COMPLETED)");
    }

    @Test
    void finalizeWithoutPriorOpenCreatesTheRecord() {
        alert.setResolvedAt(Instant.now());
        alert.setResolvedBy("system");
        service.finalizeFor(alert);
        FaultIncident incident = repository.findByAlertId("alert-1").orElseThrow();
        assertThat(incident.getDurationSeconds()).isBetween(1795L, 1805L);
        assertThat(incident.getActionsTaken()).containsExactly("Resolved by system");
    }

    @Test
    void historySearchFiltersAndSortsBySeverityRank() {
        Instant base = Instant.now().minus(Duration.ofDays(3));
        repository.save(Fixtures.incident(transformer, FaultType.OVERHEATING, Severity.CRITICAL, base, 600L));
        repository.save(Fixtures.incident(transformer, FaultType.LOW_OIL_LEVEL, Severity.MEDIUM,
                base.plus(Duration.ofHours(1)), 60L));
        repository.save(Fixtures.incident(transformer, FaultType.OVERLOADING, Severity.HIGH,
                base.plus(Duration.ofHours(2)), null));

        PageResponse<FaultIncidentDto> bySeverity = historyService.search(null, null, null, null, null, null,
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "severity")));
        assertThat(bySeverity.content()).extracting(FaultIncidentDto::severity)
                .containsExactly(Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM);

        assertThat(historyService.search(null, "Eastfield", FaultType.LOW_OIL_LEVEL, null, null, null,
                PageRequest.of(0, 10)).totalElements()).isEqualTo(1);
        assertThat(historyService.search(transformer.getId(), null, null, null,
                base.plus(Duration.ofMinutes(30)), null, PageRequest.of(0, 10)).totalElements()).isEqualTo(2);
        assertThat(historyService.search(null, "Riverside", null, null, null, null, PageRequest.of(0, 10))
                .totalElements()).isZero();

        // Default sort: newest first.
        assertThat(historyService.forTransformer(transformer.getId())).extracting(FaultIncidentDto::faultType)
                .containsExactly(FaultType.OVERLOADING, FaultType.LOW_OIL_LEVEL, FaultType.OVERHEATING);
        assertThatThrownBy(() -> historyService.forTransformer("missing")).isInstanceOf(NotFoundException.class);
    }
}
