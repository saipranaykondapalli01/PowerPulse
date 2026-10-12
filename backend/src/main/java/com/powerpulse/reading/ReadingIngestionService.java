package com.powerpulse.reading;

import com.powerpulse.alert.AlertService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.fault.FaultDetectionService;
import com.powerpulse.fault.FaultEvaluation;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.transformer.QuerySupport;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStateService;
import java.time.Clock;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * The single pipeline for device and simulated readings:
 * resolve transformer → persist reading → update latest reading → evaluate faults → reconcile alerts → refresh
 * transformer state (health, status, active fault count).
 */
@Service
public class ReadingIngestionService {

    private final TransformerRepository transformerRepository;
    private final SensorReadingRepository readingRepository;
    private final MongoTemplate mongoTemplate;
    private final FaultDetectionService faultDetectionService;
    private final AlertService alertService;
    private final TransformerStateService transformerStateService;
    private final SettingsService settingsService;
    private final Clock clock;

    @Autowired
    public ReadingIngestionService(TransformerRepository transformerRepository,
                                   SensorReadingRepository readingRepository, MongoTemplate mongoTemplate,
                                   FaultDetectionService faultDetectionService, AlertService alertService,
                                   TransformerStateService transformerStateService, SettingsService settingsService) {
        this(transformerRepository, readingRepository, mongoTemplate, faultDetectionService, alertService,
                transformerStateService, settingsService, Clock.systemUTC());
    }

    public ReadingIngestionService(TransformerRepository transformerRepository,
                                   SensorReadingRepository readingRepository, MongoTemplate mongoTemplate,
                                   FaultDetectionService faultDetectionService, AlertService alertService,
                                   TransformerStateService transformerStateService, SettingsService settingsService,
                                   Clock clock) {
        this.transformerRepository = transformerRepository;
        this.readingRepository = readingRepository;
        this.mongoTemplate = mongoTemplate;
        this.faultDetectionService = faultDetectionService;
        this.alertService = alertService;
        this.transformerStateService = transformerStateService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    public ReadingDto ingest(ReadingInput input, ReadingSource source, String simulationId, String scenario) {
        if (input == null) {
            throw new BadRequestException("Reading body is required");
        }
        Transformer t = resolve(input);
        Instant now = Instant.now(clock);
        Instant recordedAt = input.recordedAt() == null || input.recordedAt().isAfter(now) ? now : input.recordedAt();

        SensorReading reading = new SensorReading();
        reading.setTransformerId(t.getId());
        reading.setTemperatureC(input.temperatureC());
        reading.setOilLevelPct(input.oilLevelPct());
        reading.setVoltageV(input.voltageV());
        reading.setCurrentA(input.currentA());
        reading.setLoadPct(input.loadPct());
        reading.setPowerFactor(input.powerFactor());
        reading.setSource(source);
        reading.setSimulationId(source == ReadingSource.SIMULATED ? simulationId : null);
        reading.setScenario(source == ReadingSource.SIMULATED ? scenario : null);
        reading.setRecordedAt(recordedAt);
        SensorReading saved = readingRepository.insert(reading);

        ReadingSnapshot snapshot = snapshotOf(saved);
        if (!applyAsLatest(t, snapshot)) {
            // An out-of-order (older) reading is stored for history but does not drive live state.
            return ReadingDto.from(saved);
        }
        t.setLatestReading(snapshot);
        t.setLastReadingAt(recordedAt);

        FaultEvaluation evaluation = faultDetectionService.evaluate(t, snapshot, settingsService.current());
        alertService.reconcile(t, evaluation, snapshot);
        transformerStateService.refresh(t.getId());
        return ReadingDto.from(saved);
    }

    private Transformer resolve(ReadingInput input) {
        if (QuerySupport.hasText(input.transformerId())) {
            return transformerRepository.findById(input.transformerId().trim())
                    .orElseThrow(() -> new NotFoundException("Transformer", input.transformerId()));
        }
        if (QuerySupport.hasText(input.transformerCode())) {
            return transformerRepository.findByCode(input.transformerCode().trim())
                    .orElseThrow(() -> new NotFoundException("Transformer", input.transformerCode()));
        }
        throw new BadRequestException("transformerId or transformerCode is required");
    }

    /** $set latestReading/lastReadingAt only if this reading is not older than the stored one. */
    private boolean applyAsLatest(Transformer t, ReadingSnapshot snapshot) {
        Query q = Query.query(Criteria.where("_id").is(t.getId()).orOperator(
                Criteria.where("lastReadingAt").is(null),
                Criteria.where("lastReadingAt").lte(snapshot.getRecordedAt())));
        Update u = new Update().set("latestReading", snapshot).set("lastReadingAt", snapshot.getRecordedAt());
        return mongoTemplate.updateFirst(q, u, Transformer.class).getMatchedCount() > 0;
    }

    public static ReadingSnapshot snapshotOf(SensorReading r) {
        ReadingSnapshot s = new ReadingSnapshot();
        s.setTemperatureC(r.getTemperatureC());
        s.setOilLevelPct(r.getOilLevelPct());
        s.setVoltageV(r.getVoltageV());
        s.setCurrentA(r.getCurrentA());
        s.setLoadPct(r.getLoadPct());
        s.setPowerFactor(r.getPowerFactor());
        s.setRecordedAt(r.getRecordedAt());
        s.setSource(r.getSource());
        return s;
    }
}
