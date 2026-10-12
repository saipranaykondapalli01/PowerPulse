package com.powerpulse.reports;

import com.powerpulse.common.NotFoundException;
import com.powerpulse.faulthistory.FaultIncident;
import com.powerpulse.maintenance.MaintenanceDto;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.reading.SensorReading;
import com.powerpulse.transformer.Transformer;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * CSV exports. Rows are read with {@link MongoTemplate#stream} and written straight to the response, so large
 * exports (e.g. readings) are never loaded into memory. A header row is always written, even with no data.
 */
@Service
public class CsvExportService {

    static final List<String> TRANSFORMER_HEALTH_HEADER = List.of("code", "name", "location", "status", "healthScore",
            "ratedCapacityKva", "activeAlerts", "incidentsInRange", "highRisk", "lastReadingAt", "lastMaintenanceAt");
    static final List<String> FAULT_HISTORY_HEADER = List.of("incidentId", "alertId", "transformerCode", "location",
            "faultType", "severity", "startedAt", "resolvedAt", "durationSeconds", "peakValue", "threshold", "unit",
            "recurrenceCount", "resolutionNotes", "actionsTaken");
    static final List<String> MAINTENANCE_HEADER = List.of("taskId", "transformerCode", "location", "title",
            "priority", "status", "assignedTechnician", "dueDate", "overdue", "createdAt", "completedAt",
            "cancelledAt", "cancelReason", "createdBy", "inspectionFindings", "partsReplaced");
    static final List<String> READINGS_HEADER = List.of("transformerId", "transformerCode", "recordedAt",
            "temperatureC", "oilLevelPct", "voltageV", "currentA", "loadPct", "powerFactor", "source", "scenario");

    private final MongoTemplate mongoTemplate;
    private final ReportService reportService;

    public CsvExportService(MongoTemplate mongoTemplate, ReportService reportService) {
        this.mongoTemplate = mongoTemplate;
        this.reportService = reportService;
    }

    public static String filename(CsvExportType type) {
        return "powerpulse-" + type.key() + "-" + LocalDate.now(ZoneOffset.UTC) + ".csv";
    }

    /**
     * Validates the request up front (so errors are returned as JSON before streaming starts) and returns the body
     * that streams the CSV.
     */
    public StreamingResponseBody prepare(CsvExportType type, Instant from, Instant to, String location,
                                         String transformerId) {
        ReportRange range = ReportRange.of(from, to);
        if (type == CsvExportType.READINGS && hasText(transformerId)
                && !mongoTemplate.exists(Query.query(Criteria.where("_id").is(transformerId)), Transformer.class)) {
            throw new NotFoundException("Transformer", transformerId);
        }
        return out -> write(type, range, location, transformerId, out);
    }

    void write(CsvExportType type, ReportRange range, String location, String transformerId, OutputStream out)
            throws IOException {
        CsvWriter csv = new CsvWriter(new BufferedWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8)));
        try {
            switch (type) {
                case TRANSFORMER_HEALTH -> transformerHealth(csv, range, location);
                case FAULT_HISTORY -> faultHistory(csv, range, location);
                case MAINTENANCE -> maintenance(csv, range, location);
                case READINGS -> readings(csv, range, location, transformerId);
                default -> throw new IllegalStateException("Unhandled export type " + type);
            }
        } catch (UncheckedIOException e) {
            throw e.getCause();
        }
        csv.flush();
    }

    private void transformerHealth(CsvWriter csv, ReportRange range, String location) throws IOException {
        csv.row(TRANSFORMER_HEALTH_HEADER);
        Map<String, long[]> alerts = reportService.activeAlertStats(location);
        Map<String, Long> incidents = reportService.incidentsByTransformer(range, location);
        Query query = Query.query(ReportService.byLocation(new Criteria(), location))
                .with(Sort.by(Sort.Order.asc("healthScore"), Sort.Order.asc("code")));
        try (Stream<Transformer> rows = mongoTemplate.stream(query, Transformer.class)) {
            rows.forEach(t -> {
                TransformerHealthReportRow r = reportService.healthRow(t, alerts, incidents);
                write(csv, Arrays.asList(r.code(), r.name(), r.location(), r.status(), r.healthScore(),
                        t.getRatedCapacityKva(), r.activeAlerts(), r.incidentsInRange(), r.highRisk(),
                        t.getLastReadingAt(), r.lastMaintenanceAt()));
            });
        }
    }

    private void faultHistory(CsvWriter csv, ReportRange range, String location) throws IOException {
        csv.row(FAULT_HISTORY_HEADER);
        Query query = Query.query(ReportService.incidentCriteria(range, location))
                .with(Sort.by(Sort.Direction.DESC, "startedAt"));
        try (Stream<FaultIncident> rows = mongoTemplate.stream(query, FaultIncident.class)) {
            rows.forEach(i -> write(csv, Arrays.asList(i.getId(), i.getAlertId(), i.getTransformerCode(),
                    i.getLocation(), i.getFaultType(), i.getSeverity(), i.getStartedAt(), i.getResolvedAt(),
                    i.getDurationSeconds(), i.getPeakValue(), i.getThreshold(), i.getUnit(), i.getRecurrenceCount(),
                    i.getResolutionNotes(),
                    i.getActionsTaken() == null ? null : String.join("; ", i.getActionsTaken()))));
        }
    }

    private void maintenance(CsvWriter csv, ReportRange range, String location) throws IOException {
        csv.row(MAINTENANCE_HEADER);
        Instant now = Instant.now();
        Query query = Query.query(ReportService.byLocation(
                        Criteria.where("createdAt").gte(range.from()).lte(range.to()), location))
                .with(Sort.by(Sort.Direction.DESC, "createdAt"));
        try (Stream<MaintenanceTask> rows = mongoTemplate.stream(query, MaintenanceTask.class)) {
            rows.forEach(t -> write(csv, Arrays.asList(t.getId(), t.getTransformerCode(), t.getLocation(),
                    t.getTitle(), t.getPriority(), t.getStatus(), t.getAssignedTechnicianName(), t.getDueDate(),
                    MaintenanceDto.isOverdue(t, now), t.getCreatedAt(), t.getCompletedAt(), t.getCancelledAt(),
                    t.getCancelReason(), t.getCreatedByName(), t.getInspectionFindings(),
                    t.getPartsReplaced() == null ? null : String.join("; ", t.getPartsReplaced().stream()
                            .map(p -> p.getQuantity() + " x " + p.getName()).toList()))));
        }
    }

    private void readings(CsvWriter csv, ReportRange range, String location, String transformerId)
            throws IOException {
        csv.row(READINGS_HEADER);
        Map<String, String> codes = new HashMap<>();
        Query transformers = Query.query(ReportService.byLocation(new Criteria(), location));
        transformers.fields().include("_id").include("code");
        mongoTemplate.find(transformers, Transformer.class).forEach(t -> codes.put(t.getId(), t.getCode()));

        Criteria criteria = Criteria.where("recordedAt").gte(range.from()).lte(range.to());
        if (hasText(transformerId)) {
            criteria.and("transformerId").is(transformerId);
        } else if (hasText(location)) {
            criteria.and("transformerId").in(codes.keySet());
        }
        Query query = Query.query(criteria).with(Sort.by(Sort.Direction.ASC, "recordedAt"));
        try (Stream<SensorReading> rows = mongoTemplate.stream(query, SensorReading.class)) {
            rows.forEach(r -> write(csv, Arrays.asList(r.getTransformerId(), codes.get(r.getTransformerId()),
                    r.getRecordedAt(), r.getTemperatureC(), r.getOilLevelPct(), r.getVoltageV(), r.getCurrentA(),
                    r.getLoadPct(), r.getPowerFactor(), r.getSource(), r.getScenario())));
        }
    }

    private static void write(CsvWriter csv, List<?> cells) {
        try {
            csv.row(cells);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}
