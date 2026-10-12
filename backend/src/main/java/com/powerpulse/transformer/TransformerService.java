package com.powerpulse.transformer;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertDto;
import com.powerpulse.alert.AlertRepository;
import com.powerpulse.alert.AlertService;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingQueryService;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.reading.ReadingSnapshotDto;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.transformer.TransformerDtos.HealthFactorDto;
import com.powerpulse.transformer.TransformerDtos.NetworkPreviewNode;
import com.powerpulse.transformer.TransformerDtos.TransformerDetailDto;
import com.powerpulse.transformer.TransformerDtos.TransformerDto;
import com.powerpulse.transformer.TransformerDtos.TransformerUpsertRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/** Transformer registry: list/filter/sort, create/update, details with recommendations, readings and alerts. */
@Service
public class TransformerService {

    static final Set<String> SORTABLE = Set.of("code", "name", "healthScore", "status", "latestReading.temperatureC",
            "latestReading.oilLevelPct", "latestReading.loadPct", "lastReadingAt", "ratedCapacityKva");
    static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("code"));
    /** Status sorts by severity of condition rather than alphabetically. */
    private static final Map<String, List<String>> ENUM_RANKS = Map.of("status",
            List.of(TransformerStatus.HEALTHY.name(), TransformerStatus.WARNING.name(),
                    TransformerStatus.CRITICAL.name(), TransformerStatus.OFFLINE.name()));

    private final TransformerRepository transformerRepository;
    private final AlertRepository alertRepository;
    private final AlertService alertService;
    private final MongoTemplate mongoTemplate;
    private final SettingsService settingsService;
    private final RecommendationService recommendationService;
    private final TransformerStateService stateService;
    private final ReadingQueryService readingQueryService;
    private final AuditService auditService;
    private final Clock clock;

    @Autowired
    public TransformerService(TransformerRepository transformerRepository, AlertRepository alertRepository,
                              AlertService alertService, MongoTemplate mongoTemplate, SettingsService settingsService,
                              RecommendationService recommendationService, TransformerStateService stateService,
                              ReadingQueryService readingQueryService, AuditService auditService) {
        this(transformerRepository, alertRepository, alertService, mongoTemplate, settingsService,
                recommendationService, stateService, readingQueryService, auditService, Clock.systemUTC());
    }

    public TransformerService(TransformerRepository transformerRepository, AlertRepository alertRepository,
                              AlertService alertService, MongoTemplate mongoTemplate, SettingsService settingsService,
                              RecommendationService recommendationService, TransformerStateService stateService,
                              ReadingQueryService readingQueryService, AuditService auditService, Clock clock) {
        this.transformerRepository = transformerRepository;
        this.alertRepository = alertRepository;
        this.alertService = alertService;
        this.mongoTemplate = mongoTemplate;
        this.settingsService = settingsService;
        this.recommendationService = recommendationService;
        this.stateService = stateService;
        this.readingQueryService = readingQueryService;
        this.auditService = auditService;
        this.clock = clock;
    }

    public record TransformerFilter(String q, String location, TransformerStatus status, Double minCapacity,
                                    Double maxCapacity, Integer minHealth, Integer maxHealth) {
    }

    // ---------- queries ----------

    public PageResponse<TransformerDto> list(TransformerFilter f, Pageable requested) {
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        Page<Transformer> page = QuerySupport.page(mongoTemplate, criteria(f), pageable, Transformer.class,
                mongoTemplate.getCollectionName(Transformer.class), ENUM_RANKS);
        Map<String, Severity> highest = highestActiveSeverity(page.getContent().stream().map(Transformer::getId)
                .toList());
        Instant now = Instant.now(clock);
        int timeout = settingsService.current().getSensorTimeoutSeconds();
        return PageResponse.of(page, t -> toDto(t, highest.get(t.getId()), timeout, now));
    }

    static Criteria criteria(TransformerFilter f) {
        List<Criteria> and = new ArrayList<>();
        if (QuerySupport.hasText(f.q())) {
            var p = QuerySupport.containsIgnoreCase(f.q());
            and.add(new Criteria().orOperator(Criteria.where("code").regex(p), Criteria.where("name").regex(p)));
        }
        if (QuerySupport.hasText(f.location())) {
            and.add(Criteria.where("location").is(f.location()));
        }
        if (f.status() != null) {
            and.add(Criteria.where("status").is(f.status().name()));
        }
        if (f.minCapacity() != null) {
            and.add(Criteria.where("ratedCapacityKva").gte(f.minCapacity()));
        }
        if (f.maxCapacity() != null) {
            and.add(Criteria.where("ratedCapacityKva").lte(f.maxCapacity()));
        }
        if (f.minHealth() != null) {
            and.add(Criteria.where("healthScore").gte(f.minHealth()));
        }
        if (f.maxHealth() != null) {
            and.add(Criteria.where("healthScore").lte(f.maxHealth()));
        }
        return and.isEmpty() ? new Criteria() : new Criteria().andOperator(and);
    }

    public List<TransformerDto> all() {
        List<Transformer> all = transformerRepository.findAll(DEFAULT_SORT);
        Map<String, Severity> highest = highestActiveSeverity(all.stream().map(Transformer::getId).toList());
        Instant now = Instant.now(clock);
        int timeout = settingsService.current().getSensorTimeoutSeconds();
        return all.stream().map(t -> toDto(t, highest.get(t.getId()), timeout, now)).toList();
    }

    /** Distinct locations of registered transformers plus the configured locations, sorted. */
    public List<String> locations() {
        Set<String> out = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        out.addAll(mongoTemplate.findDistinct(new Query(), "location", Transformer.class, String.class));
        out.addAll(settingsService.current().getLocations());
        out.removeIf(s -> s == null || s.isBlank());
        return List.copyOf(out);
    }

    public TransformerDetailDto detail(String id) {
        Transformer t = load(id);
        List<Alert> active = alertRepository.findByTransformerIdAndActiveTrue(id);
        Severity highest = highest(active);
        int timeout = settingsService.current().getSensorTimeoutSeconds();
        Instant now = Instant.now(clock);
        TransformerDto d = toDto(t, highest, timeout, now);
        List<HealthFactorDto> factors = t.getHealthFactors() == null ? List.of() : t.getHealthFactors().stream()
                .map(h -> new HealthFactorDto(h.getFactor(), h.getPenalty(), h.getMaxPenalty(), h.getDetail()))
                .toList();
        return new TransformerDetailDto(d.id(), d.code(), d.name(), d.location(), d.latitude(), d.longitude(),
                d.gridX(), d.gridZ(), d.connectedTo(), d.ratedCapacityKva(), d.primaryVoltageKv(),
                d.secondaryVoltageV(), d.healthScore(), d.status(), d.latestReading(), d.lastReadingAt(),
                d.readingAgeSeconds(), d.stale(), d.lastMaintenanceAt(), d.activeFaultCount(),
                d.highestActiveSeverity(), d.createdAt(), d.updatedAt(), factors,
                recommendationService.recommend(t.getHealthScore(), active),
                Math.round(RatedValues.ratedCurrentA(t) * 100.0) / 100.0, timeout);
    }

    public List<ReadingDto> readings(String id, Instant from, Instant to, Integer maxPoints) {
        load(id);
        return readingQueryService.history(id, from, to, maxPoints, Instant.now(clock));
    }

    public List<AlertDto> alerts(String id, Boolean active) {
        load(id);
        return alertService.forTransformer(id, active);
    }

    /** Sanitized public view; every node is labeled simulated. */
    public List<NetworkPreviewNode> networkPreview() {
        return transformerRepository.findAll(DEFAULT_SORT).stream().map(t -> {
            ReadingSnapshot r = t.getLatestReading();
            return new NetworkPreviewNode(t.getId(), t.getCode(), t.getName(), t.getLocation(), t.getGridX(),
                    t.getGridZ(), List.copyOf(t.getConnectedTo()), t.getStatus(), t.getHealthScore(),
                    r == null ? null : r.getLoadPct(), r == null ? null : r.getTemperatureC(),
                    r == null ? null : r.getOilLevelPct(), r == null ? null : r.getVoltageV(),
                    r == null ? null : r.getCurrentA(), t.getRatedCapacityKva(), t.getActiveFaultCount(), true);
        }).toList();
    }

    // ---------- mutations ----------

    public TransformerDto create(TransformerUpsertRequest req) {
        String code = req.code().trim();
        if (transformerRepository.existsByCode(code)) {
            throw new ConflictException("A transformer with code " + code + " already exists");
        }
        Transformer t = new Transformer();
        t.setCode(code);
        t.setName(req.name().trim());
        t.setLocation(req.location().trim());
        t.setLatitude(orZero(req.latitude()));
        t.setLongitude(orZero(req.longitude()));
        t.setGridX(orZero(req.gridX()));
        t.setGridZ(orZero(req.gridZ()));
        t.setConnectedTo(validateConnections(null, req.connectedTo()));
        t.setRatedCapacityKva(req.ratedCapacityKva());
        t.setPrimaryVoltageKv(req.primaryVoltageKv());
        t.setSecondaryVoltageV(req.secondaryVoltageV());
        t.setHealthScore(100);
        t.setStatus(TransformerStatus.OFFLINE);
        t.setActiveFaultCount(0);
        Transformer saved;
        try {
            saved = transformerRepository.insert(t);
        } catch (DuplicateKeyException e) {
            throw new ConflictException("A transformer with code " + code + " already exists");
        }
        auditService.record("TRANSFORMER_CREATED", ResourceType.TRANSFORMER, saved.getId(),
                "Created transformer " + saved.getCode() + " (" + saved.getName() + ")");
        return toDto(saved, null, settingsService.current().getSensorTimeoutSeconds(), Instant.now(clock));
    }

    /** Partial update (null fields ignored), applied with a field-scoped $set. */
    public TransformerDto update(String id, TransformerUpsertRequest req) {
        Transformer existing = load(id);
        Update u = new Update();
        List<String> changed = new ArrayList<>();
        if (req.code() != null && !req.code().trim().equals(existing.getCode())) {
            String code = req.code().trim();
            if (transformerRepository.existsByCode(code)) {
                throw new ConflictException("A transformer with code " + code + " already exists");
            }
            u.set("code", code);
            changed.add("code");
        }
        setIf(u, changed, "name", req.name() == null ? null : req.name().trim());
        setIf(u, changed, "location", req.location() == null ? null : req.location().trim());
        setIf(u, changed, "latitude", req.latitude());
        setIf(u, changed, "longitude", req.longitude());
        setIf(u, changed, "gridX", req.gridX());
        setIf(u, changed, "gridZ", req.gridZ());
        if (req.connectedTo() != null) {
            u.set("connectedTo", validateConnections(id, req.connectedTo()));
            changed.add("connectedTo");
        }
        setIf(u, changed, "ratedCapacityKva", req.ratedCapacityKva());
        setIf(u, changed, "primaryVoltageKv", req.primaryVoltageKv());
        setIf(u, changed, "secondaryVoltageV", req.secondaryVoltageV());
        if (!changed.isEmpty()) {
            u.set("updatedAt", Instant.now(clock));
            try {
                mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(id)), u, Transformer.class);
            } catch (DuplicateKeyException e) {
                throw new ConflictException("A transformer with code " + req.code() + " already exists");
            }
            if (changed.contains("ratedCapacityKva") || changed.contains("secondaryVoltageV")) {
                stateService.refresh(id);
            }
            if (changed.contains("code") || changed.contains("name") || changed.contains("location")) {
                syncAlertDenormalization(id);
            }
            auditService.record("TRANSFORMER_UPDATED", ResourceType.TRANSFORMER, id,
                    "Updated " + existing.getCode() + ": " + String.join(", ", changed));
        }
        Transformer t = load(id);
        return toDto(t, highest(alertRepository.findByTransformerIdAndActiveTrue(id)),
                settingsService.current().getSensorTimeoutSeconds(), Instant.now(clock));
    }

    /** Keeps the denormalized code/name/location on active alerts in sync for search and filtering. */
    private void syncAlertDenormalization(String id) {
        Transformer t = load(id);
        mongoTemplate.updateMulti(Query.query(Criteria.where("transformerId").is(id).and("active").is(true)),
                new Update().set("transformerCode", t.getCode()).set("transformerName", t.getName())
                        .set("location", t.getLocation()), Alert.class);
    }

    // ---------- mapping ----------

    public static TransformerDto toDto(Transformer t, Severity highestActive, int timeoutSeconds, Instant now) {
        Long age = t.getLastReadingAt() == null ? null
                : Math.max(0, Duration.between(t.getLastReadingAt(), now).getSeconds());
        return new TransformerDto(t.getId(), t.getCode(), t.getName(), t.getLocation(), t.getLatitude(),
                t.getLongitude(), t.getGridX(), t.getGridZ(),
                t.getConnectedTo() == null ? List.of() : List.copyOf(t.getConnectedTo()), t.getRatedCapacityKva(),
                t.getPrimaryVoltageKv(), t.getSecondaryVoltageV(), t.getHealthScore(), t.getStatus(),
                ReadingSnapshotDto.from(t.getLatestReading()), t.getLastReadingAt(), age,
                age != null && age > timeoutSeconds, t.getLastMaintenanceAt(), t.getActiveFaultCount(),
                highestActive, t.getCreatedAt(), t.getUpdatedAt());
    }

    /** One query for the whole page: highest active-alert severity per transformer id. */
    Map<String, Severity> highestActiveSeverity(Collection<String> transformerIds) {
        Map<String, Severity> out = new HashMap<>();
        if (transformerIds.isEmpty()) {
            return out;
        }
        Query q = Query.query(Criteria.where("transformerId").in(transformerIds).and("active").is(true));
        q.fields().include("transformerId").include("severity");
        for (Alert a : mongoTemplate.find(q, Alert.class)) {
            Severity current = out.get(a.getTransformerId());
            if (a.getSeverity() != null && a.getSeverity().isHigherThan(current)) {
                out.put(a.getTransformerId(), a.getSeverity());
            }
        }
        return out;
    }

    private static Severity highest(List<Alert> alerts) {
        Severity max = null;
        for (Alert a : alerts) {
            if (a.isActive() && a.getSeverity() != null && a.getSeverity().isHigherThan(max)) {
                max = a.getSeverity();
            }
        }
        return max;
    }

    private Transformer load(String id) {
        return transformerRepository.findById(id).orElseThrow(() -> new NotFoundException("Transformer", id));
    }

    private List<String> validateConnections(String selfId, List<String> requested) {
        if (requested == null) {
            return new ArrayList<>();
        }
        Set<String> ids = new LinkedHashSet<>();
        for (String s : requested) {
            if (s != null && !s.isBlank() && !s.equals(selfId)) {
                ids.add(s.trim());
            }
        }
        if (!ids.isEmpty()) {
            long found = mongoTemplate.count(Query.query(Criteria.where("_id").in(ids)), Transformer.class);
            if (found != ids.size()) {
                throw new BadRequestException("connectedTo contains unknown transformer ids");
            }
        }
        return new ArrayList<>(ids);
    }

    private static void setIf(Update u, List<String> changed, String field, Object value) {
        if (value != null) {
            u.set(field, value);
            changed.add(field);
        }
    }

    private static double orZero(Double d) {
        return d == null ? 0 : d;
    }
}
