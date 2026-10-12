package com.powerpulse.reading;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.simulation.SimulationService;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class ManualReadingServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-11T10:00:00Z");

    private final TransformerRepository transformers = mock(TransformerRepository.class);
    private final ReadingIngestionService ingestion = mock(ReadingIngestionService.class);
    private final SimulationService simulation = mock(SimulationService.class);
    private final AuditService audit = mock(AuditService.class);
    private ManualReadingService service;

    @BeforeEach
    void setUp() {
        Transformer t = new Transformer();
        t.setId("t1");
        t.setCode("PP-TX-001");
        t.setSecondaryVoltageV(415);
        when(transformers.findById("t1")).thenReturn(Optional.of(t));
        service = new ManualReadingService(transformers, ingestion, simulation, audit, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ManualReadingRequest req(double volts, Instant at, Boolean hold) {
        return new ManualReadingRequest(71.5, 88.0, volts, 420.0, 63.0, 0.93, at, hold, "site visit");
    }

    @Test
    void holdsTransformerFromSimulatorBeforeIngestingAsManual() {
        service.record("t1", req(414, null, null));

        InOrder order = inOrder(simulation, ingestion);
        order.verify(simulation).applyScenario("manual", "t1");
        order.verify(ingestion).ingest(any(), eq(ReadingSource.MANUAL), isNull(), isNull());
        verify(audit).record(eq("READING_RECORDED_MANUALLY"), eq(ResourceType.TRANSFORMER), eq("t1"), anyString());
    }

    @Test
    void canSkipTheSimulatorHold() {
        service.record("t1", req(414, null, false));
        verify(simulation, never()).applyScenario(anyString(), anyString());
        verify(ingestion).ingest(any(), eq(ReadingSource.MANUAL), isNull(), isNull());
    }

    @Test
    void rejectsVoltageAboveTwiceRated() {
        assertThatThrownBy(() -> service.record("t1", req(900, null, null))).isInstanceOf(BadRequestException.class);
        verify(ingestion, never()).ingest(any(), any(), any(), any());
        verify(simulation, never()).applyScenario(anyString(), anyString());
    }

    @Test
    void rejectsFutureAndTooOldTimestamps() {
        assertThatThrownBy(() -> service.record("t1", req(414, NOW.plusSeconds(3600), null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.record("t1", req(414, NOW.minusSeconds(8 * 86400), null)))
                .isInstanceOf(BadRequestException.class);
        verify(ingestion, never()).ingest(any(), any(), any(), any());
    }
}
