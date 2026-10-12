package com.powerpulse.transformer;

import com.powerpulse.alert.Alert;
import com.powerpulse.alert.AlertRepository;
import com.powerpulse.faulthistory.FaultIncidentRepository;
import com.powerpulse.health.HealthAssessment;
import com.powerpulse.health.TransformerHealthService;
import com.powerpulse.settings.SettingsService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Recomputes a transformer's derived state (health score, factors, status, active fault count) from its latest
 * reading, active alerts and resolved incidents of the last 30 days. Persisted with a field-scoped update so that
 * concurrent writers of other fields (e.g. maintenance setting {@code lastMaintenanceAt}) are never overwritten.
 */
@Service
public class TransformerStateService {

    static final Duration HISTORY_WINDOW = Duration.ofDays(30);

    private final MongoTemplate mongoTemplate;
    private final TransformerRepository transformerRepository;
    private final AlertRepository alertRepository;
    private final FaultIncidentRepository incidentRepository;
    private final TransformerHealthService healthService;
    private final SettingsService settingsService;
    private final Clock clock;

    @Autowired
    public TransformerStateService(MongoTemplate mongoTemplate, TransformerRepository transformerRepository,
                                   AlertRepository alertRepository, FaultIncidentRepository incidentRepository,
                                   TransformerHealthService healthService, SettingsService settingsService) {
        this(mongoTemplate, transformerRepository, alertRepository, incidentRepository, healthService,
                settingsService, Clock.systemUTC());
    }

    public TransformerStateService(MongoTemplate mongoTemplate, TransformerRepository transformerRepository,
                                   AlertRepository alertRepository, FaultIncidentRepository incidentRepository,
                                   TransformerHealthService healthService, SettingsService settingsService,
                                   Clock clock) {
        this.mongoTemplate = mongoTemplate;
        this.transformerRepository = transformerRepository;
        this.alertRepository = alertRepository;
        this.incidentRepository = incidentRepository;
        this.healthService = healthService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    /** Recomputes and persists derived state; returns empty when the transformer no longer exists. */
    public Optional<HealthAssessment> refresh(String transformerId) {
        Optional<Transformer> found = transformerRepository.findById(transformerId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        Transformer t = found.get();
        Instant now = Instant.now(clock);
        List<Alert> active = alertRepository.findByTransformerIdAndActiveTrue(transformerId);
        long resolved = incidentRepository.countByTransformerIdAndResolvedAtAfter(transformerId,
                now.minus(HISTORY_WINDOW));
        HealthAssessment a = healthService.assess(t, t.getLatestReading(), active, resolved,
                settingsService.current(), now);
        Update update = new Update()
                .set("healthScore", a.score())
                .set("healthFactors", a.factors())
                .set("status", a.status())
                .set("activeFaultCount", a.activeFaultCount())
                .set("updatedAt", now)
                .inc("version", 1);
        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(transformerId)), update, Transformer.class);
        return Optional.of(a);
    }
}
