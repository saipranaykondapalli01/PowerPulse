package com.powerpulse.reading;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.simulation.Scenario;
import com.powerpulse.simulation.SimulationService;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Records meter readings entered by users. They go through the same {@link ReadingIngestionService} pipeline as
 * device and simulated readings (fault detection, alerts, health, status, notifications), tagged MANUAL.
 */
@Service
public class ManualReadingService {

    static final Duration MAX_BACKDATE = Duration.ofDays(7);
    static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(2);

    private final TransformerRepository transformerRepository;
    private final ReadingIngestionService ingestionService;
    private final SimulationService simulationService;
    private final AuditService auditService;
    private final Clock clock;

    @Autowired
    public ManualReadingService(TransformerRepository transformerRepository, ReadingIngestionService ingestionService,
                                SimulationService simulationService, AuditService auditService) {
        this(transformerRepository, ingestionService, simulationService, auditService, Clock.systemUTC());
    }

    ManualReadingService(TransformerRepository transformerRepository, ReadingIngestionService ingestionService,
                         SimulationService simulationService, AuditService auditService, Clock clock) {
        this.transformerRepository = transformerRepository;
        this.ingestionService = ingestionService;
        this.simulationService = simulationService;
        this.auditService = auditService;
        this.clock = clock;
    }

    public ReadingDto record(String transformerId, ManualReadingRequest req) {
        Transformer t = transformerRepository.findById(transformerId)
                .orElseThrow(() -> new NotFoundException("Transformer", transformerId));
        if (req.voltageV() > 2 * t.getSecondaryVoltageV()) {
            throw new BadRequestException("voltageV is more than twice the rated secondary voltage ("
                    + t.getSecondaryVoltageV() + " V); check the entered value");
        }
        Instant now = Instant.now(clock);
        Instant recordedAt = req.recordedAt() == null ? now : req.recordedAt();
        if (recordedAt.isAfter(now.plus(FUTURE_TOLERANCE))) {
            throw new BadRequestException("recordedAt cannot be in the future");
        }
        if (recordedAt.isBefore(now.minus(MAX_BACKDATE))) {
            throw new BadRequestException("recordedAt cannot be more than 7 days in the past");
        }

        // Hold first so a simulator tick between the two steps cannot overwrite the manual value.
        if (req.holdFromSimulator() == null || req.holdFromSimulator()) {
            simulationService.applyScenario(Scenario.MANUAL.slug(), t.getId());
        }
        ReadingInput input = new ReadingInput(t.getId(), null, req.temperatureC(), req.oilLevelPct(), req.voltageV(),
                req.currentA(), req.loadPct(), req.powerFactor(), recordedAt.isAfter(now) ? now : recordedAt);
        ReadingDto saved = ingestionService.ingest(input, ReadingSource.MANUAL, null, null);

        String note = req.note() == null || req.note().isBlank() ? "" : " — " + req.note().trim();
        auditService.record("READING_RECORDED_MANUALLY", ResourceType.TRANSFORMER, t.getId(), String.format(
                "Manual reading for %s: %.1f °C, oil %.1f %%, %.1f V, %.1f A, load %.1f %%%s",
                t.getCode(), req.temperatureC(), req.oilLevelPct(), req.voltageV(), req.currentA(), req.loadPct(), note));
        return saved;
    }
}
