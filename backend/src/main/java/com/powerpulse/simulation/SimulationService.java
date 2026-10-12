package com.powerpulse.simulation;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.reading.ReadingIngestionService;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.simulation.SimulationStatusDto.ActiveScenarioDto;
import com.powerpulse.transformer.QuerySupport;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Simulator controls and the tick that feeds SIMULATED readings through the single ingestion pipeline.
 * State lives in the {@code simulation_state} singleton and is written with field-scoped updates so a scenario set
 * by a user during a tick is not overwritten.
 */
@Service
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);
    static final String STATE_ID = "global";
    /** Scheduler jitter tolerated when comparing the elapsed time against the configured interval. */
    static final Duration INTERVAL_TOLERANCE = Duration.ofMillis(1500);

    private final SimulationStateRepository stateRepository;
    private final MongoTemplate mongoTemplate;
    private final TransformerRepository transformerRepository;
    private final ReadingIngestionService ingestionService;
    private final SimulationEngine engine;
    private final SettingsService settingsService;
    private final AuditService auditService;
    private final boolean propertyEnabled;
    private final Clock clock;
    private final Random random;

    @Autowired
    public SimulationService(SimulationStateRepository stateRepository, MongoTemplate mongoTemplate,
                             TransformerRepository transformerRepository, ReadingIngestionService ingestionService,
                             SimulationEngine engine, SettingsService settingsService, AuditService auditService,
                             @Value("${powerpulse.simulation.enabled:true}") boolean propertyEnabled) {
        this(stateRepository, mongoTemplate, transformerRepository, ingestionService, engine, settingsService,
                auditService, propertyEnabled, Clock.systemUTC(), new Random());
    }

    public SimulationService(SimulationStateRepository stateRepository, MongoTemplate mongoTemplate,
                             TransformerRepository transformerRepository, ReadingIngestionService ingestionService,
                             SimulationEngine engine, SettingsService settingsService, AuditService auditService,
                             boolean propertyEnabled, Clock clock, Random random) {
        this.stateRepository = stateRepository;
        this.mongoTemplate = mongoTemplate;
        this.transformerRepository = transformerRepository;
        this.ingestionService = ingestionService;
        this.engine = engine;
        this.settingsService = settingsService;
        this.auditService = auditService;
        this.propertyEnabled = propertyEnabled;
        this.clock = clock;
        this.random = random;
    }

    // ---------- controls ----------

    public SimulationStatusDto status() {
        return toStatus(state());
    }

    public SimulationStatusDto start() {
        SimulationState s = state();
        Update u = new Update().set("running", true);
        if (s.getRunId() == null) {
            u.set("runId", newRunId());
        }
        upsert(u);
        auditService.record("SIMULATION_STARTED", ResourceType.SIMULATION, STATE_ID, "Simulator started");
        return status();
    }

    public SimulationStatusDto pause() {
        upsert(new Update().set("running", false));
        auditService.record("SIMULATION_PAUSED", ResourceType.SIMULATION, STATE_ID, "Simulator paused");
        return status();
    }

    /** Clears all scenarios (all transformers return to nominal behavior) and starts a new run id. Keeps history. */
    public SimulationStatusDto reset() {
        upsert(new Update().set("scenarios", new HashMap<String, ActiveScenario>()).set("tick", 0L)
                .set("runId", newRunId()));
        auditService.record("SIMULATION_RESET", ResourceType.SIMULATION, STATE_ID,
                "Simulator reset: scenarios cleared");
        return status();
    }

    /**
     * Applies a scenario to one transformer. {@code healthy} clears any scenario so the transformer follows its
     * nominal baseline.
     */
    public SimulationStatusDto applyScenario(String scenarioName, String transformerId) {
        Scenario scenario = Scenario.fromSlug(scenarioName).orElseThrow(() -> new BadRequestException(
                "Unknown scenario '" + scenarioName + "'. Available: " + String.join(", ", Scenario.slugs())));
        if (!QuerySupport.hasText(transformerId)) {
            throw new BadRequestException("transformerId is required");
        }
        Transformer t = transformerRepository.findById(transformerId)
                .orElseThrow(() -> new NotFoundException("Transformer", transformerId));
        String path = "scenarios." + t.getId();
        if (scenario == Scenario.HEALTHY) {
            upsert(new Update().unset(path));
        } else {
            ActiveScenario a = new ActiveScenario();
            a.setName(scenario.slug());
            a.setStartedAt(Instant.now(clock));
            a.setStep(0);
            upsert(new Update().set(path, a));
        }
        auditService.record("SIMULATION_SCENARIO_APPLIED", ResourceType.SIMULATION, t.getId(),
                "Scenario " + scenario.slug() + " applied to " + t.getCode());
        return status();
    }

    // ---------- ticking ----------

    /**
     * Scheduled entry point: runs a tick only when the simulator is enabled by property and settings, running, and
     * the configured interval has elapsed since the last tick. Returns whether a tick ran.
     */
    public boolean scheduledTick() {
        if (!propertyEnabled) {
            return false;
        }
        SystemSettings settings = settingsService.current();
        if (!settings.getSimulation().isEnabled()) {
            return false;
        }
        SimulationState s = state();
        if (!s.isRunning()) {
            return false;
        }
        Instant now = Instant.now(clock);
        if (s.getUpdatedAt() != null) {
            Duration elapsed = Duration.between(s.getUpdatedAt(), now);
            Duration interval = Duration.ofSeconds(settings.getSimulation().getIntervalSeconds());
            if (elapsed.plus(INTERVAL_TOLERANCE).compareTo(interval) < 0) {
                return false;
            }
        }
        runTick();
        return true;
    }

    /** Generates one reading per transformer (skipping offline ones). Returns the number of readings ingested. */
    public int runTick() {
        SimulationState s = state();
        String runId = s.getRunId() != null ? s.getRunId() : newRunId();
        double noise = settingsService.current().getSimulation().getNoiseFactor();
        Instant now = Instant.now(clock);
        Map<String, ActiveScenario> scenarios = s.getScenarios() == null ? Map.of() : s.getScenarios();
        int ingested = 0;
        for (Transformer t : transformerRepository.findAll(Sort.by("code"))) {
            ActiveScenario active = scenarios.get(t.getId());
            Scenario scenario = active == null ? null : Scenario.fromSlug(active.getName()).orElse(null);
            if (scenario == Scenario.OFFLINE || scenario == Scenario.MANUAL) {
                continue;
            }
            try {
                int step = active == null ? 0 : active.getStep();
                SimulationEngine.Generated g = engine.next(t, t.getLatestReading(), scenario, step, random, noise,
                        now);
                ingestionService.ingest(g.input(), ReadingSource.SIMULATED, runId,
                        scenario == null ? null : scenario.slug());
                ingested++;
                if (active != null) {
                    advanceScenario(t.getId(), active, g.scenarioComplete());
                }
            } catch (RuntimeException e) {
                log.warn("Simulator tick failed for {}: {}", t.getCode(), e.toString(), e);
            }
        }
        Update u = new Update().inc("tick", 1).set("updatedAt", now);
        if (s.getRunId() == null) {
            u.set("runId", runId);
        }
        upsert(u);
        return ingested;
    }

    /** Advances (or clears, when finished) a scenario only if it is still the one this tick used. */
    private void advanceScenario(String transformerId, ActiveScenario used, boolean complete) {
        String path = "scenarios." + transformerId;
        Query q = Query.query(Criteria.where("_id").is(STATE_ID).and(path + ".name").is(used.getName())
                .and(path + ".step").is(used.getStep()));
        Update u = complete ? new Update().unset(path) : new Update().set(path + ".step", used.getStep() + 1);
        mongoTemplate.updateFirst(q, u, SimulationState.class);
    }

    // ---------- helpers ----------

    SimulationState state() {
        return stateRepository.findById(STATE_ID).orElseGet(() -> {
            SimulationState s = new SimulationState();
            s.setId(STATE_ID);
            return s;
        });
    }

    private void upsert(Update u) {
        mongoTemplate.upsert(Query.query(Criteria.where("_id").is(STATE_ID)), u, SimulationState.class);
    }

    private static String newRunId() {
        return "run-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private SimulationStatusDto toStatus(SimulationState s) {
        SystemSettings settings = settingsService.current();
        Map<String, ActiveScenario> scenarios = s.getScenarios() == null ? Map.of() : s.getScenarios();
        Map<String, String> codes = new HashMap<>();
        if (!scenarios.isEmpty()) {
            transformerRepository.findAllById(scenarios.keySet()).forEach(t -> codes.put(t.getId(), t.getCode()));
        }
        List<ActiveScenarioDto> list = new ArrayList<>();
        scenarios.forEach((id, a) -> list.add(new ActiveScenarioDto(id, Optional.ofNullable(codes.get(id)).orElse(id),
                a.getName(), a.getStartedAt(), a.getStep())));
        list.sort(Comparator.comparing(ActiveScenarioDto::transformerCode));
        return new SimulationStatusDto(propertyEnabled && settings.getSimulation().isEnabled(), s.isRunning(),
                s.getRunId(), s.getTick(), settings.getSimulation().getIntervalSeconds(), list, Scenario.slugs(),
                s.getUpdatedAt());
    }
}
