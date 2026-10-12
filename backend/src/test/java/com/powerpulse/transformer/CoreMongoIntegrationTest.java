package com.powerpulse.transformer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertDto;
import com.powerpulse.alert.AlertRepository;
import com.powerpulse.alert.AlertService;
import com.powerpulse.alert.AlertStatus;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.fault.FaultDetectionService;
import com.powerpulse.fault.StaleReadingJob;
import com.powerpulse.faulthistory.FaultIncidentRepository;
import com.powerpulse.faulthistory.FaultIncidentService;
import com.powerpulse.health.TransformerHealthService;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.reading.ReadingIngestionService;
import com.powerpulse.reading.ReadingQueryService;
import com.powerpulse.reading.SensorReading;
import com.powerpulse.reading.SensorReadingRepository;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.TransformerDtos.TransformerDto;
import com.powerpulse.transformer.TransformerDtos.TransformerUpsertRequest;
import com.powerpulse.common.SchedulerLockService;
import com.powerpulse.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.test.context.ActiveProfiles;

/** Query, aggregation and pipeline tests against the local MongoDB (database powerpulse_test_core). */
@DataMongoTest(properties = "spring.data.mongodb.database=powerpulse_test_core")
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(com.powerpulse.config.MongoConfig.class)
class CoreMongoIntegrationTest {

    private static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.MILLIS);

    @Autowired
    private MongoTemplate mongo;
    @Autowired
    private TransformerRepository transformerRepository;
    @Autowired
    private AlertRepository alertRepository;
    @Autowired
    private SensorReadingRepository readingRepository;
    @Autowired
    private FaultIncidentRepository incidentRepository;

    private SystemSettings settings;
    private SettingsService settingsService;
    private FaultIncidentService incidents;
    private NotificationService notifications;
    private AuditService audit;
    private TransformerStateService stateService;
    private AlertService alertService;
    private TransformerService transformerService;
    private ReadingIngestionService ingestion;
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        mongo.remove(new Query(), Transformer.class);
        mongo.remove(new Query(), Alert.class);
        mongo.remove(new Query(), SensorReading.class);
        mongo.remove(new Query(), com.powerpulse.faulthistory.FaultIncident.class);
        mongo.remove(new Query(), com.powerpulse.common.SchedulerLock.class);
        settings = new SystemSettings();
        settingsService = mock(SettingsService.class);
        when(settingsService.current()).thenReturn(settings);
        incidents = mock(FaultIncidentService.class);
        notifications = mock(NotificationService.class);
        audit = mock(AuditService.class);
        stateService = new TransformerStateService(mongo, transformerRepository, alertRepository, incidentRepository,
                new TransformerHealthService(), settingsService, clock);
        alertService = new AlertService(alertRepository, mongo, incidents, notifications, audit, stateService,
                settingsService, mock(UserRepository.class), clock);
        transformerService = new TransformerService(transformerRepository, alertRepository, alertService, mongo,
                settingsService, new RecommendationService(), stateService, new ReadingQueryService(mongo), audit,
                clock);
        ingestion = new ReadingIngestionService(transformerRepository, readingRepository, mongo,
                new FaultDetectionService(), alertService, stateService, settingsService, clock);
    }

    private Transformer save(String code, String name, String location, double kva, int health,
                             TransformerStatus status, Double temp) {
        Transformer t = new Transformer();
        t.setCode(code);
        t.setName(name);
        t.setLocation(location);
        t.setRatedCapacityKva(kva);
        t.setPrimaryVoltageKv(11);
        t.setSecondaryVoltageV(415);
        t.setHealthScore(health);
        t.setStatus(status);
        if (temp != null) {
            com.powerpulse.reading.ReadingSnapshot r = new com.powerpulse.reading.ReadingSnapshot();
            r.setTemperatureC(temp);
            r.setRecordedAt(NOW);
            r.setSource(ReadingSource.SIMULATED);
            t.setLatestReading(r);
            t.setLastReadingAt(NOW);
        }
        return transformerRepository.insert(t);
    }

    private void seedList() {
        save("PP-TX-001", "North Ridge Substation 1", "North Ridge", 1000, 95, TransformerStatus.HEALTHY, 60.0);
        save("PP-TX-002", "North Ridge Substation 2", "North Ridge", 250, 35, TransformerStatus.CRITICAL, 110.0);
        save("PP-TX-003", "Harbor District Substation 1", "Harbor District", 500, 65, TransformerStatus.WARNING,
                88.0);
        save("PP-TX-004", "Old Town (East) Substation", "Old Town", 100, 100, TransformerStatus.OFFLINE, null);
    }

    private List<String> codes(PageResponse<TransformerDto> page) {
        return page.content().stream().map(TransformerDto::code).toList();
    }

    private TransformerService.TransformerFilter filter() {
        return new TransformerService.TransformerFilter(null, null, null, null, null, null, null);
    }

    @Test
    void listFiltersByTextLocationStatusCapacityAndHealth() {
        seedList();
        var page = PageRequest.of(0, 20);
        assertThat(codes(transformerService.list(filter(), page)))
                .containsExactly("PP-TX-001", "PP-TX-002", "PP-TX-003", "PP-TX-004");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter("harbor", null, null,
                null, null, null, null), page))).containsExactly("PP-TX-003");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter("tx-00", null, null,
                null, null, null, null), page))).hasSize(4);
        // regex metacharacters are matched literally
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter("(East)", null, null,
                null, null, null, null), page))).containsExactly("PP-TX-004");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter(".*", null, null,
                null, null, null, null), page))).isEmpty();
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter(null, "North Ridge", null,
                null, null, null, null), page))).containsExactly("PP-TX-001", "PP-TX-002");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter(null, null,
                TransformerStatus.CRITICAL, null, null, null, null), page))).containsExactly("PP-TX-002");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter(null, null, null,
                200.0, 600.0, null, null), page))).containsExactly("PP-TX-002", "PP-TX-003");
        assertThat(codes(transformerService.list(new TransformerService.TransformerFilter(null, null, null,
                null, null, 50, 99), page))).containsExactly("PP-TX-001", "PP-TX-003");
    }

    @Test
    void listSortsByAllowListedFieldsAndPages() {
        seedList();
        assertThat(codes(transformerService.list(filter(), PageRequest.of(0, 20, Sort.by("healthScore")))))
                .containsExactly("PP-TX-002", "PP-TX-003", "PP-TX-001", "PP-TX-004");
        assertThat(codes(transformerService.list(filter(), PageRequest.of(0, 20,
                Sort.by(Sort.Direction.DESC, "latestReading.temperatureC")))))
                .containsExactly("PP-TX-002", "PP-TX-003", "PP-TX-001", "PP-TX-004");
        assertThat(codes(transformerService.list(filter(), PageRequest.of(0, 20,
                Sort.by(Sort.Direction.DESC, "ratedCapacityKva")))))
                .containsExactly("PP-TX-001", "PP-TX-003", "PP-TX-002", "PP-TX-004");
        // status sorts by condition (HEALTHY < WARNING < CRITICAL < OFFLINE), not alphabetically
        assertThat(codes(transformerService.list(filter(), PageRequest.of(0, 20, Sort.by("status")))))
                .containsExactly("PP-TX-001", "PP-TX-003", "PP-TX-002", "PP-TX-004");
        // non-allow-listed field falls back to code asc
        assertThat(codes(transformerService.list(filter(), PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC,
                "passwordHash"))))).containsExactly("PP-TX-001", "PP-TX-002", "PP-TX-003", "PP-TX-004");

        PageResponse<TransformerDto> p1 = transformerService.list(filter(), PageRequest.of(1, 3, Sort.by("code")));
        assertThat(codes(p1)).containsExactly("PP-TX-004");
        assertThat(p1.totalElements()).isEqualTo(4);
        assertThat(p1.totalPages()).isEqualTo(2);
    }

    @Test
    void dtoCarriesHighestActiveSeverityAgeAndStaleFlag() {
        seedList();
        Transformer t2 = transformerRepository.findByCode("PP-TX-002").orElseThrow();
        alertRepository.insert(alert(t2, FaultType.OVERHEATING, Severity.CRITICAL, true));
        alertRepository.insert(alert(t2, FaultType.OVERLOADING, Severity.MEDIUM, true));
        alertRepository.insert(alert(t2, FaultType.LOW_OIL_LEVEL, Severity.HIGH, false));
        List<TransformerDto> all = transformerService.all();
        TransformerDto d2 = all.stream().filter(d -> d.code().equals("PP-TX-002")).findFirst().orElseThrow();
        assertThat(d2.highestActiveSeverity()).isEqualTo(Severity.CRITICAL);
        assertThat(d2.readingAgeSeconds()).isZero();
        assertThat(d2.stale()).isFalse();
        TransformerDto d4 = all.stream().filter(d -> d.code().equals("PP-TX-004")).findFirst().orElseThrow();
        assertThat(d4.highestActiveSeverity()).isNull();
        assertThat(d4.readingAgeSeconds()).isNull();
        assertThat(transformerService.locations()).contains("Eastfield", "Harbor District", "North Ridge",
                "Old Town", "Riverside");
    }

    @Test
    void createRejectsDuplicateCodeAndStartsOffline() {
        TransformerUpsertRequest req = new TransformerUpsertRequest("PP-TX-100", "New", "Eastfield", 1.0, 2.0, 3.0,
                4.0, null, 400.0, 11.0, 415.0);
        TransformerDto dto = transformerService.create(req);
        assertThat(dto.status()).isEqualTo(TransformerStatus.OFFLINE);
        assertThat(dto.createdAt()).isNotNull();
        assertThatThrownBy(() -> transformerService.create(req)).isInstanceOf(ConflictException.class);

        save("PP-TX-101", "Other", "Eastfield", 100, 100, TransformerStatus.OFFLINE, null);
        assertThatThrownBy(() -> transformerService.update(dto.id(), new TransformerUpsertRequest("PP-TX-101", null,
                null, null, null, null, null, null, null, null, null))).isInstanceOf(ConflictException.class);
        TransformerDto renamed = transformerService.update(dto.id(), new TransformerUpsertRequest(null, "Renamed",
                null, null, null, null, null, null, null, null, null));
        assertThat(renamed.name()).isEqualTo("Renamed");
        assertThat(renamed.ratedCapacityKva()).isEqualTo(400.0);
    }

    @Test
    void readingsAreAscendingAndDownsampledWhenOverMaxPoints() {
        Transformer t = save("PP-TX-001", "A", "North Ridge", 500, 100, TransformerStatus.HEALTHY, null);
        List<SensorReading> rows = new ArrayList<>();
        Instant start = NOW.minus(Duration.ofMinutes(100));
        for (int i = 0; i < 100; i++) {
            SensorReading r = new SensorReading();
            r.setTransformerId(t.getId());
            r.setTemperatureC((double) i);
            r.setLoadPct(50.0);
            r.setSource(ReadingSource.SIMULATED);
            r.setRecordedAt(start.plus(Duration.ofMinutes(i)));
            rows.add(r);
        }
        mongo.insertAll(rows);

        List<ReadingDto> raw = transformerService.readings(t.getId(), start, NOW, 500);
        assertThat(raw).hasSize(100);
        assertThat(raw.get(0).temperatureC()).isEqualTo(0.0);
        assertThat(raw.get(99).temperatureC()).isEqualTo(99.0);

        List<ReadingDto> down = transformerService.readings(t.getId(), start, NOW, 10);
        assertThat(down).hasSizeLessThanOrEqualTo(10).hasSizeGreaterThanOrEqualTo(9);
        assertThat(down).isSortedAccordingTo((a, b) -> a.recordedAt().compareTo(b.recordedAt()));
        assertThat(down.get(0).temperatureC()).isBetween(4.0, 5.0); // average of the first ~10 minutes
        assertThat(down.get(0).source()).isEqualTo(ReadingSource.SIMULATED);
        assertThat(down.get(0).loadPct()).isEqualTo(50.0);

        // default window is the last 24 h
        assertThat(transformerService.readings(t.getId(), null, null, null)).hasSize(100);
    }

    @Test
    void alertListFiltersAndSortsBySeverityRank() {
        Transformer t = save("PP-TX-001", "North Ridge Substation 1", "North Ridge", 500, 100,
                TransformerStatus.HEALTHY, 60.0);
        Transformer u = save("PP-TX-002", "Harbor 2", "Harbor District", 500, 100, TransformerStatus.HEALTHY, 60.0);
        alertRepository.insert(alert(t, FaultType.OVERHEATING, Severity.MEDIUM, true));
        alertRepository.insert(alert(t, FaultType.LOW_OIL_LEVEL, Severity.CRITICAL, true));
        alertRepository.insert(alert(u, FaultType.OVERLOADING, Severity.HIGH, true));
        alertRepository.insert(alert(u, FaultType.SENSOR_FAILURE, Severity.LOW, false));

        var sevDesc = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "severity"));
        PageResponse<AlertDto> all = alertService.list(alertFilter(null, null, null, null), sevDesc);
        assertThat(all.content()).extracting(AlertDto::severity)
                .containsExactly(Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW);
        assertThat(alertService.list(alertFilter("harbor", null, null, null), sevDesc).content()).hasSize(2);
        assertThat(alertService.list(alertFilter(null, true, null, null), sevDesc).totalElements()).isEqualTo(3);
        assertThat(alertService.list(alertFilter(null, null, "North Ridge", null), sevDesc).content())
                .extracting(AlertDto::faultType).containsExactly(FaultType.LOW_OIL_LEVEL, FaultType.OVERHEATING);
        assertThat(alertService.list(alertFilter(null, null, null, FaultType.OVERLOADING), sevDesc).content())
                .hasSize(1);
        assertThat(alertService.list(new AlertService.AlertFilter(null, null, null, null, null, null, null,
                NOW.plusSeconds(3600), null), sevDesc).content()).isEmpty();
    }

    @Test
    void partialUniqueIndexAllowsOnlyOneActiveAlertPerIncidentKey() {
        Transformer t = save("PP-TX-001", "A", "North Ridge", 500, 100, TransformerStatus.HEALTHY, 60.0);
        alertRepository.insert(alert(t, FaultType.OVERHEATING, Severity.MEDIUM, false));
        alertRepository.insert(alert(t, FaultType.OVERHEATING, Severity.MEDIUM, true));
        assertThatThrownBy(() -> alertRepository.insert(alert(t, FaultType.OVERHEATING, Severity.HIGH, true)))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void ingestionPipelineCreatesAlertAndUpdatesStateWithoutClobberingMaintenance() {
        Transformer t = save("PP-TX-001", "A", "North Ridge", 500, 100, TransformerStatus.OFFLINE, null);
        // maintenance module wrote lastMaintenanceAt concurrently
        Instant maintained = NOW.minus(Duration.ofDays(2));
        mongo.updateFirst(Query.query(Criteria.where("_id").is(t.getId())),
                new Update().set("lastMaintenanceAt", maintained), Transformer.class);

        ReadingDto dto = ingestion.ingest(new ReadingInput(null, "PP-TX-001", 112.0, 90.0, 415.0, 300.0, 50.0, 0.95,
                null), ReadingSource.DEVICE, null, null);
        assertThat(dto.source()).isEqualTo(ReadingSource.DEVICE);
        assertThat(dto.recordedAt()).isEqualTo(NOW);

        Transformer after = transformerRepository.findById(t.getId()).orElseThrow();
        assertThat(after.getLatestReading().getTemperatureC()).isEqualTo(112.0);
        assertThat(after.getLastReadingAt()).isEqualTo(NOW);
        assertThat(after.getStatus()).isEqualTo(TransformerStatus.CRITICAL);
        assertThat(after.getActiveFaultCount()).isEqualTo(1);
        assertThat(after.getHealthScore()).isLessThan(100);
        assertThat(after.getHealthFactors()).hasSize(5);
        assertThat(after.getLastMaintenanceAt()).isEqualTo(maintained);

        List<Alert> active = alertRepository.findByTransformerIdAndActiveTrue(t.getId());
        assertThat(active).hasSize(1);
        assertThat(active.get(0).getFaultType()).isEqualTo(FaultType.OVERHEATING);
        assertThat(active.get(0).getSeverity()).isEqualTo(Severity.CRITICAL);
        verify(notifications).notifyNewCriticalAlert(any(Alert.class));

        // dedup with the real partial unique index across repeated readings
        ingestion.ingest(new ReadingInput(t.getId(), null, 113.0, 90.0, 415.0, 300.0, 50.0, 0.95, null),
                ReadingSource.SIMULATED, "run-1", "critical-overheating");
        assertThat(alertRepository.findByTransformerIdAndActiveTrue(t.getId())).hasSize(1);

        // an older out-of-order reading is stored but does not replace the latest
        ingestion.ingest(new ReadingInput(t.getId(), null, 20.0, 90.0, 415.0, 300.0, 50.0, 0.95,
                NOW.minusSeconds(600)), ReadingSource.DEVICE, null, null);
        assertThat(transformerRepository.findById(t.getId()).orElseThrow().getLatestReading().getTemperatureC())
                .isEqualTo(113.0);
        assertThat(readingRepository.count()).isEqualTo(3);
    }

    @Test
    void staleJobOpensStaleAlertSetsOfflineAndNotifiesOnce() {
        Transformer t = save("PP-TX-001", "A", "North Ridge", 500, 100, TransformerStatus.HEALTHY, 60.0);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(t.getId())),
                new Update().set("lastReadingAt", NOW.minusSeconds(300)), Transformer.class);
        StaleReadingJob job = new StaleReadingJob(new SchedulerLockService(mongo), mongo,
                new FaultDetectionService(), alertService, stateService, notifications, settingsService, clock);
        assertThat(job.checkAll()).isEqualTo(1);
        assertThat(job.checkAll()).isEqualTo(1);

        List<Alert> active = alertRepository.findByTransformerIdAndActiveTrue(t.getId());
        assertThat(active).hasSize(1);
        Alert stale = active.get(0);
        assertThat(stale.getFaultType()).isEqualTo(FaultType.STALE_READING);
        assertThat(stale.getSeverity()).isEqualTo(Severity.HIGH);
        assertThat(stale.getUnit()).isEqualTo("s");
        assertThat(stale.getMeasuredValue()).isEqualTo(300.0);
        assertThat(stale.getThreshold()).isEqualTo(120.0);
        assertThat(transformerRepository.findById(t.getId()).orElseThrow().getStatus())
                .isEqualTo(TransformerStatus.OFFLINE);
        verify(notifications, org.mockito.Mockito.times(1)).notifyTransformerOffline(any(), any());
        job.run(); // lock-guarded entry point works
    }

    private AlertService.AlertFilter alertFilter(String q, Boolean active, String location, FaultType type) {
        return new AlertService.AlertFilter(q, null, null, type, null, location, active, null, null);
    }

    private static Alert alert(Transformer t, FaultType type, Severity severity, boolean active) {
        Alert a = new Alert();
        a.setTransformerId(t.getId());
        a.setTransformerCode(t.getCode());
        a.setTransformerName(t.getName());
        a.setLocation(t.getLocation());
        a.setFaultType(type);
        a.setSeverity(severity);
        a.setPeakSeverity(severity);
        a.setDescription(type + " finding");
        a.setUnit("%");
        a.setStatus(active ? AlertStatus.NEW : AlertStatus.RESOLVED);
        a.setActive(active);
        a.setIncidentKey(AlertService.incidentKey(t.getId(), type));
        return a;
    }
}
