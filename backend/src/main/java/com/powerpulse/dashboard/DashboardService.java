package com.powerpulse.dashboard;

import static com.powerpulse.dashboard.QuerySupport.stage;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.reading.SensorReading;
import com.powerpulse.security.AuthenticatedUser;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStatus;
import com.powerpulse.user.Role;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Dashboard aggregations computed directly in MongoDB. */
@Service
public class DashboardService {

    static final int RECENT_LIMIT = 8;
    static final List<MaintenanceStatus> OPEN_TASKS =
            List.of(MaintenanceStatus.PENDING, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS);
    private static final Duration DEFAULT_TREND_WINDOW = Duration.ofHours(24);
    private static final Duration DEFAULT_FAULT_WINDOW = Duration.ofDays(30);
    private static final Duration MAX_TREND_WINDOW = Duration.ofDays(366);
    private static final int[][] HEALTH_RANGES = {{0, 19}, {20, 39}, {40, 59}, {60, 79}, {80, 100}};

    private final MongoTemplate mongoTemplate;

    public DashboardService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    // ---------------------------------------------------------------- summary

    public DashboardSummary summary(String location, TransformerStatus status, Instant from, Instant to) {
        QuerySupport.requireOrdered(from, to);
        Instant now = Instant.now();
        Criteria transformerCriteria = transformerCriteria(location, status);

        Document notOffline = new Document("$ne", List.of("$status", TransformerStatus.OFFLINE.name()));
        Document group = new Document("_id", null)
                .append("total", new Document("$sum", 1))
                .append("healthy", countIf(new Document("$eq", List.of("$status", "HEALTHY"))))
                .append("warning", countIf(new Document("$eq", List.of("$status", "WARNING"))))
                .append("critical", countIf(new Document("$eq", List.of("$status", "CRITICAL"))))
                .append("offline", countIf(new Document("$eq", List.of("$status", "OFFLINE"))))
                .append("capacity", new Document("$sum", "$ratedCapacityKva"))
                .append("onlineCapacity", sumIf(notOffline, "$ratedCapacityKva"))
                .append("weightedHealth", sumIf(notOffline,
                        new Document("$multiply", List.of("$healthScore", "$ratedCapacityKva"))))
                .append("loadKva", sumIf(
                        new Document("$and", List.of(notOffline, new Document("$isNumber", "$latestReading.loadPct"))),
                        new Document("$multiply", List.of(
                                new Document("$divide", List.of("$latestReading.loadPct", 100)), "$ratedCapacityKva"))));
        Document totals = first(mongoTemplate.aggregate(Aggregation.newAggregation(Transformer.class,
                Aggregation.match(transformerCriteria), stage("$group", group)), Document.class).getMappedResults());

        long total = QuerySupport.toLong(totals.get("total"));
        double onlineCapacity = number(totals.get("onlineCapacity"));
        Integer networkHealth = onlineCapacity > 0
                ? (int) Math.round(number(totals.get("weightedHealth")) / onlineCapacity) : null;

        boolean filtered = hasText(location) || status != null;
        List<String> ids = filtered ? transformerIds(transformerCriteria) : null;

        Criteria activeAlerts = scoped(Criteria.where("active").is(true), ids);
        long activeAlertCount = mongoTemplate.count(Query.query(activeAlerts), Alert.class);
        long activeCritical = mongoTemplate.count(Query.query(
                scoped(Criteria.where("active").is(true).and("severity").is(Severity.CRITICAL), ids)), Alert.class);

        AuthenticatedUser user = CurrentUser.get().orElse(null);
        String technicianId = user != null && user.role() == Role.TECHNICIAN ? user.id() : null;
        Criteria openTasks = taskScope(Criteria.where("status").in(OPEN_TASKS), ids, technicianId);
        long pending = mongoTemplate.count(Query.query(openTasks), MaintenanceTask.class);
        long overdue = mongoTemplate.count(Query.query(
                taskScope(Criteria.where("status").in(OPEN_TASKS).and("dueDate").lt(now), ids, technicianId)),
                MaintenanceTask.class);

        Criteria recentAlerts = scoped(withRange(new Criteria(), "createdAt", from, to), ids);
        List<IncidentSummary> recentIncidents = mongoTemplate.find(Query.query(recentAlerts)
                        .with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(RECENT_LIMIT), Alert.class)
                .stream().map(IncidentSummary::from).toList();
        Criteria recentTasks = taskScope(withRange(new Criteria(), "createdAt", from, to), ids, technicianId);
        List<MaintenanceSummary> recentMaintenance = mongoTemplate.find(Query.query(recentTasks)
                        .with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(RECENT_LIMIT), MaintenanceTask.class)
                .stream().map(t -> MaintenanceSummary.from(t, now)).toList();

        return new DashboardSummary(total,
                QuerySupport.toLong(totals.get("healthy")),
                QuerySupport.toLong(totals.get("warning")),
                QuerySupport.toLong(totals.get("critical")),
                QuerySupport.toLong(totals.get("offline")),
                networkHealth,
                QuerySupport.round(number(totals.get("loadKva")), 1),
                QuerySupport.round(number(totals.get("capacity")), 1),
                activeAlertCount, activeCritical, pending, overdue,
                recentIncidents, recentMaintenance, now);
    }

    // ---------------------------------------------------------------- trends

    public List<TrendPoint> trends(Instant from, Instant to, String location, String bucket) {
        Instant end = to != null ? to : Instant.now();
        Instant start = from != null ? from : end.minus(DEFAULT_TREND_WINDOW);
        QuerySupport.requireOrdered(start, end);
        if (Duration.between(start, end).compareTo(MAX_TREND_WINDOW) > 0) {
            throw new BadRequestException("Trend window must not exceed 366 days");
        }
        String unit = bucketUnit(bucket);

        Criteria match = Criteria.where("recordedAt").gte(start).lte(end);
        if (hasText(location)) {
            match.and("transformerId").in(transformerIds(Criteria.where("location").is(location)));
        }
        Document group = new Document("_id", new Document("$dateTrunc",
                new Document("date", "$recordedAt").append("unit", unit)))
                .append("avgTemp", new Document("$avg", "$temperatureC"))
                .append("maxTemp", new Document("$max", "$temperatureC"))
                .append("avgLoad", new Document("$avg", "$loadPct"))
                .append("maxLoad", new Document("$max", "$loadPct"))
                .append("n", new Document("$sum", 1));
        List<Document> rows = mongoTemplate.aggregate(Aggregation.newAggregation(SensorReading.class,
                        Aggregation.match(match), stage("$group", group), stage("$sort", new Document("_id", 1))),
                Document.class).getMappedResults();
        return rows.stream().map(d -> new TrendPoint(QuerySupport.toInstant(d.get("_id")),
                QuerySupport.round(QuerySupport.toDouble(d.get("avgTemp")), 2),
                QuerySupport.round(QuerySupport.toDouble(d.get("maxTemp")), 2),
                QuerySupport.round(QuerySupport.toDouble(d.get("avgLoad")), 2),
                QuerySupport.round(QuerySupport.toDouble(d.get("maxLoad")), 2),
                QuerySupport.toLong(d.get("n")))).toList();
    }

    // ---------------------------------------------------------------- health distribution

    /** Always returns the five buckets 0–19, 20–39, 40–59, 60–79, 80–100 (zero counts included). */
    public List<HealthBucket> healthDistribution(String location) {
        Criteria criteria = hasText(location) ? Criteria.where("location").is(location) : new Criteria();
        List<Document> branches = new ArrayList<>();
        for (int i = 0; i < HEALTH_RANGES.length - 1; i++) {
            branches.add(new Document("case", new Document("$lte", List.of("$healthScore", HEALTH_RANGES[i][1])))
                    .append("then", i));
        }
        Document bucketExpr = new Document("$switch",
                new Document("branches", branches).append("default", HEALTH_RANGES.length - 1));
        List<Document> rows = mongoTemplate.aggregate(Aggregation.newAggregation(Transformer.class,
                        Aggregation.match(criteria),
                        stage("$group", new Document("_id", bucketExpr).append("n", new Document("$sum", 1)))),
                Document.class).getMappedResults();
        long[] counts = new long[HEALTH_RANGES.length];
        for (Document row : rows) {
            int index = (int) QuerySupport.toLong(row.get("_id"));
            if (index >= 0 && index < counts.length) {
                counts[index] = QuerySupport.toLong(row.get("n"));
            }
        }
        List<HealthBucket> buckets = new ArrayList<>();
        for (int i = 0; i < HEALTH_RANGES.length; i++) {
            int min = HEALTH_RANGES[i][0];
            int max = HEALTH_RANGES[i][1];
            buckets.add(new HealthBucket(min + "-" + max, min, max, counts[i]));
        }
        return buckets;
    }

    // ---------------------------------------------------------------- fault frequency

    /** Alerts created in the window grouped by fault type (critical = peak severity CRITICAL). Default: 30 days. */
    public List<FaultFrequency> faultFrequency(Instant from, Instant to, String location) {
        Instant end = to != null ? to : Instant.now();
        Instant start = from != null ? from : end.minus(DEFAULT_FAULT_WINDOW);
        QuerySupport.requireOrdered(start, end);
        Criteria match = Criteria.where("createdAt").gte(start).lte(end);
        if (hasText(location)) {
            match.and("location").is(location);
        }
        Document isCritical = new Document("$eq", List.of(
                new Document("$ifNull", List.of("$peakSeverity", "$severity")), Severity.CRITICAL.name()));
        List<AggregationOperation> ops = List.of(
                Aggregation.match(match),
                stage("$group", new Document("_id", "$faultType")
                        .append("count", new Document("$sum", 1))
                        .append("critical", countIf(isCritical))),
                stage("$sort", new Document("count", -1).append("_id", 1)));
        List<Document> rows = mongoTemplate.aggregate(Aggregation.newAggregation(Alert.class, ops), Document.class)
                .getMappedResults();
        Map<FaultType, FaultFrequency> result = new LinkedHashMap<>();
        for (Document row : rows) {
            Object type = row.get("_id");
            if (type == null) {
                continue;
            }
            FaultType faultType = FaultType.valueOf(type.toString());
            result.put(faultType, new FaultFrequency(faultType, QuerySupport.toLong(row.get("count")),
                    QuerySupport.toLong(row.get("critical"))));
        }
        return new ArrayList<>(result.values());
    }

    // ---------------------------------------------------------------- helpers

    private List<String> transformerIds(Criteria criteria) {
        Query query = Query.query(criteria);
        query.fields().include("_id");
        return mongoTemplate.find(query, Transformer.class).stream().map(Transformer::getId).toList();
    }

    private static Criteria transformerCriteria(String location, TransformerStatus status) {
        Criteria criteria = new Criteria();
        if (hasText(location)) {
            criteria.and("location").is(location);
        }
        if (status != null) {
            criteria.and("status").is(status);
        }
        return criteria;
    }

    private static Criteria scoped(Criteria criteria, List<String> transformerIds) {
        if (transformerIds != null) {
            criteria.and("transformerId").in(transformerIds);
        }
        return criteria;
    }

    private static Criteria taskScope(Criteria criteria, List<String> transformerIds, String technicianId) {
        scoped(criteria, transformerIds);
        if (technicianId != null) {
            criteria.and("assignedTechnicianId").is(technicianId);
        }
        return criteria;
    }

    static Criteria withRange(Criteria criteria, String field, Instant from, Instant to) {
        if (from != null || to != null) {
            Criteria c = criteria.and(field);
            if (from != null) {
                c.gte(from);
            }
            if (to != null) {
                c.lte(to);
            }
        }
        return criteria;
    }

    private static String bucketUnit(String bucket) {
        if (bucket == null || bucket.isBlank()) {
            return "hour";
        }
        return switch (bucket.trim().toUpperCase(Locale.ROOT)) {
            case "HOUR" -> "hour";
            case "DAY" -> "day";
            default -> throw new BadRequestException("bucket must be HOUR or DAY");
        };
    }

    static Document countIf(Document condition) {
        return new Document("$sum", new Document("$cond", List.of(condition, 1, 0)));
    }

    static Document sumIf(Document condition, Object value) {
        return new Document("$sum", new Document("$cond", List.of(condition, value, 0)));
    }

    private static Document first(List<Document> rows) {
        return rows.isEmpty() ? new Document() : rows.get(0);
    }

    private static double number(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0.0;
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
