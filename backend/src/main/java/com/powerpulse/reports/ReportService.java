package com.powerpulse.reports;

import static com.powerpulse.dashboard.QuerySupport.stage;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.dashboard.DashboardService;
import com.powerpulse.dashboard.FaultFrequency;
import com.powerpulse.dashboard.QuerySupport;
import com.powerpulse.faulthistory.FaultIncident;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.transformer.Transformer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Report aggregations over a time window (default: last 30 days) and an optional location. */
@Service
public class ReportService {

    /** Health below this score marks a transformer as high risk (as does any active CRITICAL alert). */
    static final int HIGH_RISK_SCORE = 60;
    private static final List<String> OPEN_TASKS = List.of(MaintenanceStatus.PENDING.name(),
            MaintenanceStatus.ASSIGNED.name(), MaintenanceStatus.IN_PROGRESS.name());

    private final MongoTemplate mongoTemplate;
    private final DashboardService dashboardService;

    public ReportService(MongoTemplate mongoTemplate, DashboardService dashboardService) {
        this.mongoTemplate = mongoTemplate;
        this.dashboardService = dashboardService;
    }

    // ---------------------------------------------------------------- summary

    public ReportSummary summary(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        Criteria transformers = byLocation(new Criteria(), location);
        long transformerCount = mongoTemplate.count(Query.query(transformers), Transformer.class);
        Document avg = first(aggregate(Transformer.class, Aggregation.match(byLocation(new Criteria(), location)),
                stage("$group", new Document("_id", null).append("avg", new Document("$avg", "$healthScore")))));
        Double averageHealth = transformerCount == 0 ? null : QuerySupport.round(QuerySupport.toDouble(avg.get("avg")), 1);

        Criteria incidentsInRange = incidentCriteria(range, location);
        long incidents = mongoTemplate.count(Query.query(incidentsInRange), FaultIncident.class);
        Document resolved = first(aggregate(FaultIncident.class,
                Aggregation.match(incidentCriteria(range, location).and("resolvedAt").ne(null)),
                stage("$group", new Document("_id", null)
                        .append("n", new Document("$sum", 1))
                        .append("avg", new Document("$avg", "$durationSeconds")))));
        long resolvedCount = QuerySupport.toLong(resolved.get("n"));
        Double mttr = resolvedCount == 0 ? null : QuerySupport.round(QuerySupport.toDouble(resolved.get("avg")), 1);

        long created = mongoTemplate.count(Query.query(byLocation(
                Criteria.where("createdAt").gte(range.from()).lte(range.to()), location)), MaintenanceTask.class);
        long completed = mongoTemplate.count(Query.query(byLocation(
                Criteria.where("completedAt").gte(range.from()).lte(range.to()), location)), MaintenanceTask.class);
        long highRisk = transformerHealth(range.from(), range.to(), location).stream()
                .filter(TransformerHealthReportRow::highRisk).count();

        return new ReportSummary(range.from(), range.to(), transformerCount, averageHealth, incidents, resolvedCount,
                mttr, created, completed, highRisk);
    }

    // ---------------------------------------------------------------- fault frequency

    public List<FaultFrequency> faultFrequency(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        return dashboardService.faultFrequency(range.from(), range.to(), location);
    }

    // ---------------------------------------------------------------- maintenance

    public MaintenanceReport maintenance(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        Date now = new Date();
        Criteria match = byLocation(Criteria.where("createdAt").gte(range.from()).lte(range.to()), location);
        Document facets = new Document()
                .append("byStatus", List.of(new Document("$group",
                        new Document("_id", "$status").append("n", new Document("$sum", 1)))))
                .append("byPriority", List.of(new Document("$group",
                        new Document("_id", "$priority").append("n", new Document("$sum", 1)))))
                .append("completion", List.of(
                        new Document("$match", new Document("status", MaintenanceStatus.COMPLETED.name())
                                .append("completedAt", new Document("$ne", null))),
                        new Document("$group", new Document("_id", null)
                                .append("onTime", countIf(new Document("$lte", List.of("$completedAt", "$dueDate"))))
                                .append("late", countIf(new Document("$gt", List.of("$completedAt", "$dueDate"))))
                                .append("avgMs", new Document("$avg",
                                        new Document("$subtract", List.of("$completedAt", "$createdAt")))))))
                .append("overdueOpen", List.of(
                        new Document("$match", new Document("status", new Document("$in", OPEN_TASKS))
                                .append("dueDate", new Document("$lt", now))),
                        new Document("$count", "n")))
                .append("byTechnician", List.of(
                        new Document("$match", new Document("assignedTechnicianId", new Document("$ne", null))),
                        new Document("$group", new Document("_id", "$assignedTechnicianId")
                                .append("name", new Document("$last", "$assignedTechnicianName"))
                                .append("assigned", new Document("$sum", 1))
                                .append("completed", countIf(new Document("$eq",
                                        List.of("$status", MaintenanceStatus.COMPLETED.name()))))),
                        new Document("$sort", new Document("assigned", -1).append("_id", 1))));
        Document result = first(aggregate(MaintenanceTask.class, Aggregation.match(match), stage("$facet", facets)));

        Map<String, Long> statusCounts = countsById(result.getList("byStatus", Document.class, List.of()));
        List<MaintenanceReport.StatusCount> byStatus = new ArrayList<>();
        for (MaintenanceStatus s : MaintenanceStatus.values()) {
            byStatus.add(new MaintenanceReport.StatusCount(s, statusCounts.getOrDefault(s.name(), 0L)));
        }
        Map<String, Long> priorityCounts = countsById(result.getList("byPriority", Document.class, List.of()));
        List<MaintenanceReport.PriorityCount> byPriority = new ArrayList<>();
        for (Priority p : Priority.values()) {
            byPriority.add(new MaintenanceReport.PriorityCount(p, priorityCounts.getOrDefault(p.name(), 0L)));
        }
        Document completion = first(result.getList("completion", Document.class, List.of()));
        Document overdue = first(result.getList("overdueOpen", Document.class, List.of()));
        Double avgMs = QuerySupport.toDouble(completion.get("avgMs"));
        List<MaintenanceReport.TechnicianStats> byTechnician = result
                .getList("byTechnician", Document.class, List.of()).stream()
                .map(d -> new MaintenanceReport.TechnicianStats(String.valueOf(d.get("_id")), d.getString("name"),
                        QuerySupport.toLong(d.get("assigned")), QuerySupport.toLong(d.get("completed"))))
                .toList();
        return new MaintenanceReport(byStatus, byPriority,
                QuerySupport.toLong(completion.get("onTime")),
                QuerySupport.toLong(completion.get("late")),
                QuerySupport.toLong(overdue.get("n")),
                avgMs == null ? null : QuerySupport.round(avgMs / 3_600_000.0, 1),
                byTechnician);
    }

    // ---------------------------------------------------------------- transformer health

    /** Rows sorted by health ascending; {@code highRisk} when score &lt; 60 or an active CRITICAL alert exists. */
    public List<TransformerHealthReportRow> transformerHealth(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        Map<String, long[]> alerts = activeAlertStats(location);
        Map<String, Long> incidents = incidentsByTransformer(range, location);
        Query query = Query.query(byLocation(new Criteria(), location))
                .with(Sort.by(Sort.Order.asc("healthScore"), Sort.Order.asc("code")));
        return mongoTemplate.find(query, Transformer.class).stream()
                .map(t -> healthRow(t, alerts, incidents)).toList();
    }

    TransformerHealthReportRow healthRow(Transformer t, Map<String, long[]> alerts, Map<String, Long> incidents) {
        long[] stats = alerts.getOrDefault(t.getId(), new long[2]);
        boolean highRisk = t.getHealthScore() < HIGH_RISK_SCORE || stats[1] > 0;
        return new TransformerHealthReportRow(t.getId(), t.getCode(), t.getName(), t.getLocation(),
                t.getHealthScore(), t.getStatus(), stats[0], incidents.getOrDefault(t.getId(), 0L), highRisk,
                t.getLastMaintenanceAt());
    }

    /** transformerId → {active alerts, active CRITICAL alerts}. */
    Map<String, long[]> activeAlertStats(String location) {
        List<Document> rows = aggregate(Alert.class,
                Aggregation.match(byLocation(Criteria.where("active").is(true), location)),
                stage("$group", new Document("_id", "$transformerId")
                        .append("n", new Document("$sum", 1))
                        .append("critical", countIf(new Document("$eq",
                                List.of("$severity", Severity.CRITICAL.name()))))));
        Map<String, long[]> map = new HashMap<>();
        for (Document d : rows) {
            map.put(String.valueOf(d.get("_id")),
                    new long[] {QuerySupport.toLong(d.get("n")), QuerySupport.toLong(d.get("critical"))});
        }
        return map;
    }

    Map<String, Long> incidentsByTransformer(ReportRange range, String location) {
        List<Document> rows = aggregate(FaultIncident.class, Aggregation.match(incidentCriteria(range, location)),
                stage("$group", new Document("_id", "$transformerId").append("n", new Document("$sum", 1))));
        return countsById(rows);
    }

    // ---------------------------------------------------------------- incident durations

    public List<IncidentDurationRow> incidentDurations(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        List<Document> rows = aggregate(FaultIncident.class,
                Aggregation.match(incidentCriteria(range, location).and("durationSeconds").ne(null)),
                stage("$group", new Document("_id", "$faultType")
                        .append("n", new Document("$sum", 1))
                        .append("avg", new Document("$avg", "$durationSeconds"))
                        .append("max", new Document("$max", "$durationSeconds"))),
                stage("$sort", new Document("n", -1).append("_id", 1)));
        return rows.stream().filter(d -> d.get("_id") != null)
                .map(d -> new IncidentDurationRow(FaultType.valueOf(d.get("_id").toString()),
                        QuerySupport.toLong(d.get("n")),
                        QuerySupport.round(QuerySupport.toDouble(d.get("avg")), 1),
                        d.get("max") instanceof Number n ? n.longValue() : null))
                .toList();
    }

    // ---------------------------------------------------------------- downtime

    /** STALE_READING (offline) incidents per transformer; ongoing incidents count up to now. */
    public List<DowntimeRow> downtime(Instant from, Instant to, String location) {
        ReportRange range = ReportRange.of(from, to);
        Date now = new Date();
        Document seconds = new Document("$ifNull", List.of("$durationSeconds",
                new Document("$dateDiff", new Document("startDate", "$startedAt")
                        .append("endDate", now).append("unit", "second"))));
        List<Document> rows = aggregate(FaultIncident.class,
                Aggregation.match(incidentCriteria(range, location).and("faultType").is(FaultType.STALE_READING)),
                stage("$group", new Document("_id", "$transformerId")
                        .append("code", new Document("$last", "$transformerCode"))
                        .append("location", new Document("$last", "$location"))
                        .append("n", new Document("$sum", 1))
                        .append("seconds", new Document("$sum", seconds))),
                stage("$sort", new Document("seconds", -1).append("_id", 1)));
        return rows.stream().map(d -> new DowntimeRow(String.valueOf(d.get("_id")), d.getString("code"),
                d.getString("location"), QuerySupport.toLong(d.get("n")),
                Math.max(0, QuerySupport.toLong(d.get("seconds"))))).toList();
    }

    // ---------------------------------------------------------------- helpers

    static Criteria incidentCriteria(ReportRange range, String location) {
        return byLocation(Criteria.where("startedAt").gte(range.from()).lte(range.to()), location);
    }

    static Criteria byLocation(Criteria criteria, String location) {
        if (location != null && !location.isBlank()) {
            criteria.and("location").is(location);
        }
        return criteria;
    }

    private List<Document> aggregate(Class<?> type, AggregationOperation... ops) {
        return mongoTemplate.aggregate(Aggregation.newAggregation(type, ops), Document.class).getMappedResults();
    }

    private static Map<String, Long> countsById(List<Document> rows) {
        Map<String, Long> map = new HashMap<>();
        for (Document d : rows) {
            if (d.get("_id") != null) {
                map.put(d.get("_id").toString(), QuerySupport.toLong(d.get("n")));
            }
        }
        return map;
    }

    private static Document countIf(Document condition) {
        return new Document("$sum", new Document("$cond", List.of(condition, 1, 0)));
    }

    private static Document first(List<Document> rows) {
        return rows == null || rows.isEmpty() ? new Document() : rows.get(0);
    }
}
