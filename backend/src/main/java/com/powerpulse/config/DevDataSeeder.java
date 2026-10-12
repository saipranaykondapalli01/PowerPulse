package com.powerpulse.config;

import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.reading.ReadingSnapshot;
import com.powerpulse.reading.SensorReading;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.simulation.ActiveScenario;
import com.powerpulse.simulation.Scenario;
import com.powerpulse.simulation.SimulationEngine;
import com.powerpulse.simulation.SimulationService;
import com.powerpulse.simulation.SimulationState;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/**
 * Development-only demo network: 20 transformers in 5 location clusters, 24 h of backfilled SIMULATED readings at
 * 10-minute intervals, a few pre-seeded scenarios (so WARNING/CRITICAL examples are visible immediately) and a
 * running simulator. Idempotent: does nothing when transformers already exist. All data is SIMULATED.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(name = "powerpulse.seed.enabled", havingValue = "true")
@Order(50)
public class DevDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    static final int PER_LOCATION = 4;
    static final Duration BACKFILL = Duration.ofHours(24);
    static final Duration BACKFILL_STEP = Duration.ofMinutes(10);
    static final double CLUSTER_RADIUS = 13;
    static final double NODE_RADIUS = 4.5;
    static final double CITY_LAT = 41.2034;
    static final double CITY_LON = -73.8121;
    static final double[] HUB_CAPACITY = {1000, 800, 630, 750, 1000};
    static final double[] NODE_CAPACITY = {500, 315, 250, 400, 200, 160, 315, 100, 250, 500, 200, 400, 160, 315, 250};

    /** code → (scenario, pre-advanced step) so the initial network shows WARNING and CRITICAL examples. */
    static final Map<String, Object[]> PRESET_SCENARIOS = Map.of(
            "PP-TX-003", new Object[] {Scenario.RISING_TEMPERATURE, 8},
            "PP-TX-011", new Object[] {Scenario.RISING_TEMPERATURE, 8},
            "PP-TX-007", new Object[] {Scenario.LOW_OIL, 7},
            "PP-TX-016", new Object[] {Scenario.OVERLOADING, 5});

    private final MongoTemplate mongoTemplate;
    private final TransformerRepository transformerRepository;
    private final SettingsService settingsService;
    private final SimulationEngine engine;
    private final SimulationService simulationService;

    public DevDataSeeder(MongoTemplate mongoTemplate, TransformerRepository transformerRepository,
                         SettingsService settingsService, SimulationEngine engine,
                         SimulationService simulationService) {
        this.mongoTemplate = mongoTemplate;
        this.transformerRepository = transformerRepository;
        this.settingsService = settingsService;
        this.engine = engine;
        this.simulationService = simulationService;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (transformerRepository.count() > 0) {
            log.info("Dev seed skipped: transformers already present");
            return;
        }
        SystemSettings settings = settingsService.current();
        List<Transformer> transformers = buildNetwork(settings.getLocations());
        mongoTemplate.insertAll(transformers);

        Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        int readings = backfill(transformers, now, settings.getSimulation().getNoiseFactor());

        SimulationState state = new SimulationState();
        state.setId("global");
        state.setRunning(true);
        state.setRunId("run-" + UUID.randomUUID().toString().substring(0, 8));
        state.setTick(0);
        Map<String, ActiveScenario> scenarios = new HashMap<>();
        for (Transformer t : transformers) {
            Object[] preset = PRESET_SCENARIOS.get(t.getCode());
            if (preset != null) {
                ActiveScenario a = new ActiveScenario();
                a.setName(((Scenario) preset[0]).slug());
                a.setStartedAt(now);
                a.setStep((Integer) preset[1]);
                scenarios.put(t.getId(), a);
            }
        }
        state.setScenarios(scenarios);
        mongoTemplate.save(state);

        // One reading per transformer through the real pipeline: alerts, incidents, health and status.
        int ingested = simulationService.runTick();
        log.info("Dev seed: {} transformers, {} backfilled SIMULATED readings, {} live readings, {} scenarios",
                transformers.size(), readings, ingested, scenarios.size());
    }

    /** 5 clusters (one per location) of 4 transformers on a ~40×40 scene, radial feeders plus inter-cluster ties. */
    static List<Transformer> buildNetwork(List<String> locations) {
        List<Transformer> out = new ArrayList<>();
        int clusters = Math.min(5, locations.size());
        List<Transformer> hubs = new ArrayList<>();
        int nodeIndex = 0;
        for (int c = 0; c < clusters; c++) {
            String location = locations.get(c);
            double angle = Math.toRadians(-90 + c * 72);
            double cx = CLUSTER_RADIUS * Math.cos(angle);
            double cz = CLUSTER_RADIUS * Math.sin(angle);
            List<Transformer> cluster = new ArrayList<>();
            for (int i = 0; i < PER_LOCATION; i++) {
                int number = c * PER_LOCATION + i + 1;
                Transformer t = new Transformer();
                t.setId(new ObjectId().toHexString());
                t.setCode(String.format("PP-TX-%03d", number));
                t.setName(location + " Substation " + (i + 1));
                t.setLocation(location);
                double x = cx;
                double z = cz;
                if (i > 0) {
                    double a = angle + Math.toRadians(-100 + (i - 1) * 100);
                    x += NODE_RADIUS * Math.cos(a);
                    z += NODE_RADIUS * Math.sin(a);
                }
                t.setGridX(round(x, 2));
                t.setGridZ(round(z, 2));
                t.setLatitude(round(CITY_LAT - z * 0.0025, 5));
                t.setLongitude(round(CITY_LON + x * 0.0033, 5));
                t.setRatedCapacityKva(i == 0 ? HUB_CAPACITY[c % HUB_CAPACITY.length]
                        : NODE_CAPACITY[nodeIndex++ % NODE_CAPACITY.length]);
                t.setPrimaryVoltageKv(11);
                t.setSecondaryVoltageV(415);
                t.setHealthScore(100);
                t.setStatus(TransformerStatus.OFFLINE);
                cluster.add(t);
            }
            // Radial feeder: hub → node 2, hub → node 3, node 3 → node 4.
            cluster.get(0).getConnectedTo().add(cluster.get(1).getId());
            cluster.get(0).getConnectedTo().add(cluster.get(2).getId());
            cluster.get(2).getConnectedTo().add(cluster.get(3).getId());
            hubs.add(cluster.get(0));
            out.addAll(cluster);
        }
        // Inter-cluster ties between neighbouring hubs (not a full ring).
        for (int c = 0; c + 1 < hubs.size(); c++) {
            if (c != 1) {
                hubs.get(c).getConnectedTo().add(hubs.get(c + 1).getId());
            }
        }
        return out;
    }

    private int backfill(List<Transformer> transformers, Instant now, double noise) {
        Random rng = new Random(42);
        String runId = "seed-backfill";
        int total = 0;
        long steps = BACKFILL.dividedBy(BACKFILL_STEP);
        for (Transformer t : transformers) {
            List<SensorReading> batch = new ArrayList<>();
            ReadingSnapshot prev = null;
            for (long i = steps; i >= 1; i--) {
                Instant at = now.minus(BACKFILL_STEP.multipliedBy(i));
                ReadingInput in = engine.baseline(t, prev, rng, noise, at);
                SensorReading r = new SensorReading();
                r.setTransformerId(t.getId());
                r.setTemperatureC(in.temperatureC());
                r.setOilLevelPct(in.oilLevelPct());
                r.setVoltageV(in.voltageV());
                r.setCurrentA(in.currentA());
                r.setLoadPct(in.loadPct());
                r.setPowerFactor(in.powerFactor());
                r.setSource(ReadingSource.SIMULATED);
                r.setSimulationId(runId);
                r.setRecordedAt(at);
                batch.add(r);
                prev = SimulationEngine.toSnapshot(in);
            }
            BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, SensorReading.class);
            bulk.insert(batch);
            bulk.execute();
            total += batch.size();
            if (prev != null) {
                mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(t.getId())),
                        new Update().set("latestReading", prev).set("lastReadingAt", prev.getRecordedAt()),
                        Transformer.class);
                t.setLatestReading(prev);
                t.setLastReadingAt(prev.getRecordedAt());
            }
        }
        return total;
    }

    private static double round(double v, int digits) {
        double f = Math.pow(10, digits);
        return Math.round(v * f) / f;
    }
}
