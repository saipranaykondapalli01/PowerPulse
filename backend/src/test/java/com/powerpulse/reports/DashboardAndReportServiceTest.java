package com.powerpulse.reports;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.powerpulse.alert.AlertRepository;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.dashboard.DashboardService;
import com.powerpulse.dashboard.DashboardSummary;
import com.powerpulse.dashboard.FaultFrequency;
import com.powerpulse.dashboard.HealthBucket;
import com.powerpulse.dashboard.TrendPoint;
import com.powerpulse.faulthistory.FaultIncidentRepository;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.MaintenanceTaskRepository;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.reading.SensorReadingRepository;
import com.powerpulse.support.Fixtures;
import com.powerpulse.support.MongoWorkflowTest;
import com.powerpulse.support.TestAuth;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStatus;
import com.powerpulse.user.Role;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;

@MongoWorkflowTest
@Import({DashboardService.class, ReportService.class, CsvExportService.class})
class DashboardAndReportServiceTest {

    @Autowired DashboardService dashboard;
    @Autowired ReportService reports;
    @Autowired CsvExportService csv;
    @Autowired MongoTemplate mongoTemplate;
    @Autowired TransformerRepository transformerRepository;
    @Autowired AlertRepository alertRepository;
    @Autowired MaintenanceTaskRepository taskRepository;
    @Autowired FaultIncidentRepository incidentRepository;
    @Autowired SensorReadingRepository readingRepository;

    Instant now;
    Transformer a;
    Transformer b;
    Transformer c;
    Transformer d;
    Transformer e;

    @BeforeEach
    void setUp() {
        Fixtures.clean(mongoTemplate);
        TestAuth.loginAs("eng-1", "Erin Engineer", Role.ENGINEER);
        now = Instant.now();
        a = transformerRepository.save(Fixtures.transformer("PP-TX-A", "North Ridge", TransformerStatus.HEALTHY, 90, 1000, 50.0));
        b = transformerRepository.save(Fixtures.transformer("PP-TX-B", "North Ridge", TransformerStatus.WARNING, 65, 500, 80.0));
        c = transformerRepository.save(Fixtures.transformer("PP-TX-C", "Eastfield", TransformerStatus.CRITICAL, 35, 250, 100.0));
        d = transformerRepository.save(Fixtures.transformer("PP-TX-D", "Eastfield", TransformerStatus.OFFLINE, 10, 400, 70.0));
        e = transformerRepository.save(Fixtures.transformer("PP-TX-E", "Riverside", TransformerStatus.HEALTHY, 82, 100, null));

        alertRepository.save(Fixtures.alert(c, FaultType.OVERHEATING, Severity.CRITICAL, true, ago(Duration.ofHours(1))));
        alertRepository.save(Fixtures.alert(b, FaultType.LOW_OIL_LEVEL, Severity.MEDIUM, true, ago(Duration.ofHours(2))));
        alertRepository.save(Fixtures.alert(d, FaultType.STALE_READING, Severity.HIGH, true, ago(Duration.ofHours(3))));
        alertRepository.save(Fixtures.alert(a, FaultType.OVERHEATING, Severity.HIGH, false, ago(Duration.ofDays(10))));
        alertRepository.save(Fixtures.alert(c, FaultType.OVERLOADING, Severity.HIGH, false, ago(Duration.ofDays(40))));

        task(a, "t1", MaintenanceStatus.PENDING, Duration.ofDays(-2), Duration.ofDays(1), null, null);
        task(b, "t2", MaintenanceStatus.ASSIGNED, Duration.ofDays(1), Duration.ofDays(5), "tech-1", null);
        task(c, "t3", MaintenanceStatus.IN_PROGRESS, Duration.ofDays(-1), Duration.ofDays(2), "tech-1", null);
        task(c, "t4", MaintenanceStatus.COMPLETED, Duration.ofDays(3), Duration.ofDays(6), "tech-2", Duration.ofDays(4));
        task(d, "t5", MaintenanceStatus.COMPLETED, Duration.ofDays(10), Duration.ofDays(12), "tech-2", Duration.ofDays(8));
        task(e, "t6", MaintenanceStatus.CANCELLED, Duration.ofDays(1), Duration.ofDays(7), null, null);

        incidentRepository.save(Fixtures.incident(c, FaultType.OVERHEATING, Severity.CRITICAL, ago(Duration.ofHours(1)), null));
        incidentRepository.save(Fixtures.incident(a, FaultType.OVERHEATING, Severity.HIGH, ago(Duration.ofDays(10)), 3600L));
        incidentRepository.save(Fixtures.incident(d, FaultType.STALE_READING, Severity.HIGH, ago(Duration.ofHours(3)), null));
        incidentRepository.save(Fixtures.incident(d, FaultType.STALE_READING, Severity.HIGH, ago(Duration.ofDays(5)), 1200L));
        incidentRepository.save(Fixtures.incident(c, FaultType.OVERLOADING, Severity.HIGH, ago(Duration.ofDays(40)), 999L));
        incidentRepository.save(Fixtures.incident(b, FaultType.LOW_OIL_LEVEL, Severity.MEDIUM, ago(Duration.ofDays(2)), 600L));
    }

    @AfterEach
    void tearDown() {
        TestAuth.logout();
    }

    private Instant ago(Duration duration) {
        return now.minus(duration);
    }

    /** dueIn negative = overdue. */
    private void task(Transformer t, String title, MaintenanceStatus status, Duration dueAgo, Duration createdAgo,
                      String technicianId, Duration completedAgo) {
        MaintenanceTask task = Fixtures.task(t, title, status, Priority.MEDIUM, now.minus(dueAgo), now.minus(createdAgo));
        if (technicianId != null) {
            task.setAssignedTechnicianId(technicianId);
            task.setAssignedTechnicianName("Name " + technicianId);
        }
        if (completedAgo != null) {
            task.setCompletedAt(now.minus(completedAgo));
        }
        taskRepository.save(task);
    }

    // ------------------------------------------------------------ dashboard

    @Test
    void summaryCountsMatchRepositoryCounts() {
        DashboardSummary s = dashboard.summary(null, null, null, null);

        assertThat(s.totalTransformers()).isEqualTo(transformerRepository.count());
        assertThat(s.healthy()).isEqualTo(transformerRepository.countByStatus(TransformerStatus.HEALTHY));
        assertThat(s.warning()).isEqualTo(transformerRepository.countByStatus(TransformerStatus.WARNING));
        assertThat(s.critical()).isEqualTo(transformerRepository.countByStatus(TransformerStatus.CRITICAL));
        assertThat(s.offline()).isEqualTo(transformerRepository.countByStatus(TransformerStatus.OFFLINE));
        assertThat(s.activeAlerts()).isEqualTo(alertRepository.countByActiveTrue());
        assertThat(s.pendingMaintenance()).isEqualTo(taskRepository.countByStatusIn(
                List.of(MaintenanceStatus.PENDING, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS)));

        assertThat(s.totalTransformers()).isEqualTo(5);
        assertThat(s.activeAlerts()).isEqualTo(3);
        assertThat(s.activeCriticalAlerts()).isEqualTo(1);
        assertThat(s.pendingMaintenance()).isEqualTo(3);
        assertThat(s.overdueMaintenance()).isEqualTo(1);
        // (90*1000 + 65*500 + 35*250 + 82*100) / 1850 = 75.38 (offline D excluded)
        assertThat(s.networkHealth()).isEqualTo(75);
        // 0.5*1000 + 0.8*500 + 1.0*250 (D offline, E has no reading)
        assertThat(s.totalLoadKva()).isEqualTo(1150.0);
        assertThat(s.totalCapacityKva()).isEqualTo(2250.0);
        assertThat(s.recentIncidents()).hasSize(5);
        assertThat(s.recentIncidents().get(0).transformerCode()).isEqualTo("PP-TX-C");
        assertThat(s.recentMaintenance()).hasSize(6);
        assertThat(s.recentMaintenance().get(0).title()).isEqualTo("t1");
        assertThat(s.recentMaintenance()).filteredOn(m -> m.title().equals("t2")).singleElement()
                .satisfies(m -> assertThat(m.overdue()).isTrue());
        assertThat(s.generatedAt()).isNotNull();
    }

    @Test
    void summaryRespectsFilters() {
        DashboardSummary north = dashboard.summary("North Ridge", null, null, null);
        assertThat(north.totalTransformers()).isEqualTo(2);
        assertThat(north.activeAlerts()).isEqualTo(1);
        assertThat(north.activeCriticalAlerts()).isZero();
        assertThat(north.pendingMaintenance()).isEqualTo(2);
        assertThat(north.networkHealth()).isEqualTo((int) Math.round((90 * 1000 + 65 * 500) / 1500.0));

        DashboardSummary offline = dashboard.summary(null, TransformerStatus.OFFLINE, null, null);
        assertThat(offline.totalTransformers()).isEqualTo(1);
        assertThat(offline.networkHealth()).isNull();
        assertThat(offline.totalLoadKva()).isZero();
        assertThat(offline.activeAlerts()).isEqualTo(1);

        DashboardSummary recent = dashboard.summary(null, null, ago(Duration.ofDays(3)), null);
        assertThat(recent.recentIncidents()).hasSize(3);
        assertThat(recent.recentMaintenance()).extracting(m -> m.title()).containsExactly("t1", "t3");

        TestAuth.loginAs("tech-2", "Tech Two", Role.TECHNICIAN);
        DashboardSummary techView = dashboard.summary(null, null, null, null);
        assertThat(techView.pendingMaintenance()).isZero();
        assertThat(techView.recentMaintenance()).extracting(m -> m.title()).containsExactlyInAnyOrder("t4", "t5");
    }

    @Test
    void emptyDatabaseYieldsNullNetworkHealth() {
        Fixtures.clean(mongoTemplate);
        DashboardSummary s = dashboard.summary(null, null, null, null);
        assertThat(s.totalTransformers()).isZero();
        assertThat(s.networkHealth()).isNull();
        assertThat(dashboard.healthDistribution(null)).hasSize(5).allSatisfy(bk -> assertThat(bk.count()).isZero());
    }

    @Test
    void healthDistributionAlwaysReturnsFiveBuckets() {
        List<HealthBucket> buckets = dashboard.healthDistribution(null);
        assertThat(buckets).extracting(HealthBucket::range)
                .containsExactly("0-19", "20-39", "40-59", "60-79", "80-100");
        assertThat(buckets).extracting(HealthBucket::count).containsExactly(1L, 1L, 0L, 1L, 2L);
        assertThat(buckets.get(4).min()).isEqualTo(80);
        assertThat(buckets.get(4).max()).isEqualTo(100);

        assertThat(dashboard.healthDistribution("Riverside")).extracting(HealthBucket::count)
                .containsExactly(0L, 0L, 0L, 0L, 1L);
    }

    @Test
    void faultFrequencyGroupsAlertsInWindow() {
        List<FaultFrequency> freq = dashboard.faultFrequency(null, null, null);
        assertThat(freq.get(0)).isEqualTo(new FaultFrequency(FaultType.OVERHEATING, 2, 1));
        assertThat(freq).hasSize(3);
        assertThat(freq).extracting(FaultFrequency::faultType).doesNotContain(FaultType.OVERLOADING);
        assertThat(dashboard.faultFrequency(null, null, "Eastfield"))
                .containsExactlyInAnyOrder(new FaultFrequency(FaultType.OVERHEATING, 1, 1),
                        new FaultFrequency(FaultType.STALE_READING, 1, 0));
    }

    @Test
    void trendsBucketReadingsByHourAndDay() {
        Instant hour = now.truncatedTo(ChronoUnit.HOURS).minus(Duration.ofHours(2));
        readingRepository.save(Fixtures.reading(c.getId(), hour.plus(Duration.ofMinutes(5)), 60, 50));
        readingRepository.save(Fixtures.reading(c.getId(), hour.plus(Duration.ofMinutes(10)), 70, 60));
        readingRepository.save(Fixtures.reading(a.getId(), hour.plus(Duration.ofMinutes(15)), 100, 90));
        readingRepository.save(Fixtures.reading(c.getId(), hour.plus(Duration.ofMinutes(65)), 80, 70));
        readingRepository.save(Fixtures.reading(c.getId(), now.minus(Duration.ofDays(3)), 10, 10));

        List<TrendPoint> points = dashboard.trends(null, null, null, null);
        assertThat(points).hasSize(2);
        assertThat(points.get(0).bucket()).isEqualTo(hour);
        assertThat(points.get(0).readings()).isEqualTo(3);
        assertThat(points.get(0).avgTemperatureC()).isEqualTo(76.67);
        assertThat(points.get(0).maxTemperatureC()).isEqualTo(100.0);
        assertThat(points.get(0).avgLoadPct()).isEqualTo(66.67);
        assertThat(points.get(1).bucket()).isEqualTo(hour.plus(Duration.ofHours(1)));
        assertThat(points.get(1).readings()).isEqualTo(1);

        List<TrendPoint> east = dashboard.trends(null, null, "Eastfield", "hour");
        assertThat(east.get(0).readings()).isEqualTo(2);
        assertThat(east.get(0).avgTemperatureC()).isEqualTo(65.0);

        List<TrendPoint> daily = dashboard.trends(now.minus(Duration.ofDays(5)), now, null, "DAY");
        assertThat(daily.stream().mapToLong(TrendPoint::readings).sum()).isEqualTo(5);
        assertThatThrownBy(() -> dashboard.trends(null, null, null, "WEEK")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> dashboard.trends(now, now.minus(Duration.ofHours(1)), null, null))
                .isInstanceOf(BadRequestException.class);
    }

    // ------------------------------------------------------------ reports

    @Test
    void reportSummaryNumbers() {
        ReportSummary s = reports.summary(null, null, null);
        assertThat(Duration.between(s.from(), s.to())).isEqualTo(Duration.ofDays(30));
        assertThat(s.transformers()).isEqualTo(5);
        assertThat(s.averageHealth()).isEqualTo(56.4);
        assertThat(s.incidents()).isEqualTo(5);
        assertThat(s.resolvedIncidents()).isEqualTo(3);
        assertThat(s.meanTimeToResolveSeconds()).isEqualTo(1800.0);
        assertThat(s.maintenanceCreated()).isEqualTo(6);
        assertThat(s.maintenanceCompleted()).isEqualTo(2);
        assertThat(s.highRiskTransformers()).isEqualTo(2);

        ReportSummary north = reports.summary(null, null, "North Ridge");
        assertThat(north.transformers()).isEqualTo(2);
        assertThat(north.incidents()).isEqualTo(2);
        assertThat(north.highRiskTransformers()).isZero();
    }

    @Test
    void maintenanceReportNumbers() {
        MaintenanceReport r = reports.maintenance(null, null, null);
        assertThat(r.byStatus()).extracting(MaintenanceReport.StatusCount::count).containsExactly(1L, 1L, 1L, 2L, 1L);
        assertThat(r.byPriority()).hasSize(4);
        assertThat(r.byPriority()).filteredOn(p -> p.priority() == Priority.MEDIUM).singleElement()
                .satisfies(p -> assertThat(p.count()).isEqualTo(6));
        assertThat(r.completedOnTime()).isEqualTo(1);
        assertThat(r.completedLate()).isEqualTo(1);
        assertThat(r.overdueOpen()).isEqualTo(1);
        assertThat(r.averageCompletionHours()).isEqualTo(72.0);
        assertThat(r.byTechnician()).containsExactly(
                new MaintenanceReport.TechnicianStats("tech-1", "Name tech-1", 2, 0),
                new MaintenanceReport.TechnicianStats("tech-2", "Name tech-2", 2, 2));
    }

    @Test
    void transformerHealthRowsSortedWithHighRiskFlags() {
        List<TransformerHealthReportRow> rows = reports.transformerHealth(null, null, null);
        assertThat(rows).extracting(TransformerHealthReportRow::code)
                .containsExactly("PP-TX-D", "PP-TX-C", "PP-TX-B", "PP-TX-E", "PP-TX-A");
        assertThat(rows).extracting(TransformerHealthReportRow::highRisk)
                .containsExactly(true, true, false, false, false);
        assertThat(rows).extracting(TransformerHealthReportRow::activeAlerts).containsExactly(1L, 1L, 1L, 0L, 0L);
        assertThat(rows).extracting(TransformerHealthReportRow::incidentsInRange).containsExactly(2L, 1L, 1L, 0L, 1L);

        // An active CRITICAL alert makes a healthy-scoring transformer high risk.
        alertRepository.save(Fixtures.alert(a, FaultType.OVERLOADING, Severity.CRITICAL, true, now));
        assertThat(reports.transformerHealth(null, null, null)).filteredOn(r -> r.code().equals("PP-TX-A"))
                .singleElement().satisfies(r -> assertThat(r.highRisk()).isTrue());
    }

    @Test
    void incidentDurationsAndDowntime() {
        List<IncidentDurationRow> durations = reports.incidentDurations(null, null, null);
        assertThat(durations).containsExactly(
                new IncidentDurationRow(FaultType.LOW_OIL_LEVEL, 1, 600.0, 600L),
                new IncidentDurationRow(FaultType.OVERHEATING, 1, 3600.0, 3600L),
                new IncidentDurationRow(FaultType.STALE_READING, 1, 1200.0, 1200L));

        List<DowntimeRow> downtime = reports.downtime(null, null, null);
        assertThat(downtime).singleElement().satisfies(row -> {
            assertThat(row.code()).isEqualTo("PP-TX-D");
            assertThat(row.offlineIncidents()).isEqualTo(2);
            // 1200 s resolved + ~3 h ongoing (counted up to now)
            assertThat(row.totalOfflineSeconds()).isBetween(1200L + 10_790L, 1200L + 10_830L);
        });
        assertThat(reports.downtime(null, null, "North Ridge")).isEmpty();
    }

    // ------------------------------------------------------------ CSV

    private String export(CsvExportType type, String location, String transformerId) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        csv.prepare(type, null, null, location, transformerId).writeTo(out);
        return out.toString(StandardCharsets.UTF_8);
    }

    @Test
    void csvExportsHaveHeadersRowsAndEscaping() throws Exception {
        MaintenanceTask nasty = Fixtures.task(a, "=HYPERLINK(\"http://evil\")", MaintenanceStatus.PENDING,
                Priority.LOW, now.plus(Duration.ofDays(1)), now);
        nasty.setInspectionFindings("Fan \"A\", noisy\nreplace soon");
        taskRepository.save(nasty);

        String maintenance = export(CsvExportType.MAINTENANCE, null, null);
        String[] lines = maintenance.split("\r\n");
        assertThat(lines[0]).isEqualTo(String.join(",", CsvExportService.MAINTENANCE_HEADER));
        assertThat(maintenance).contains("\"'=HYPERLINK(\"\"http://evil\"\")\"");
        assertThat(maintenance).contains("\"Fan \"\"A\"\", noisy\nreplace soon\"");

        String health = export(CsvExportType.TRANSFORMER_HEALTH, null, null);
        List<String> healthLines = health.lines().toList();
        assertThat(healthLines.get(0)).isEqualTo(String.join(",", CsvExportService.TRANSFORMER_HEALTH_HEADER));
        assertThat(healthLines).hasSize(6);
        assertThat(healthLines.get(1)).startsWith("PP-TX-D,Transformer PP-TX-D,Eastfield,OFFLINE,10,400,1,2,true,");

        String faults = export(CsvExportType.FAULT_HISTORY, "Eastfield", null);
        assertThat(faults.lines().toList()).hasSize(1 + 3);

        readingRepository.save(Fixtures.reading(c.getId(), now.minus(Duration.ofHours(1)), 61.5, 45));
        readingRepository.save(Fixtures.reading(b.getId(), now.minus(Duration.ofHours(1)), 55, 40));
        String readings = export(CsvExportType.READINGS, null, c.getId());
        List<String> readingLines = readings.lines().toList();
        assertThat(readingLines.get(0)).isEqualTo(String.join(",", CsvExportService.READINGS_HEADER));
        assertThat(readingLines).hasSize(2);
        assertThat(readingLines.get(1)).startsWith(c.getId() + ",PP-TX-C,").contains(",SIMULATED,");
    }

    @Test
    void csvExportWithNoRowsStillHasHeaderAndUnknownTransformerIs404() throws Exception {
        Fixtures.clean(mongoTemplate);
        assertThat(export(CsvExportType.READINGS, null, null))
                .isEqualTo(String.join(",", CsvExportService.READINGS_HEADER) + "\r\n");
        assertThat(export(CsvExportType.FAULT_HISTORY, null, null).lines().toList()).hasSize(1);
        assertThatThrownBy(() -> csv.prepare(CsvExportType.READINGS, null, null, null, "missing"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> CsvExportType.parse("users")).isInstanceOf(BadRequestException.class);
        assertThat(CsvExportType.parse("fault-history")).isEqualTo(CsvExportType.FAULT_HISTORY);
    }

    @Test
    void reportRangeRejectsInvertedWindow() {
        assertThatThrownBy(() -> reports.summary(now, now.minus(Duration.ofDays(1)), null))
                .isInstanceOf(BadRequestException.class);
    }
}
