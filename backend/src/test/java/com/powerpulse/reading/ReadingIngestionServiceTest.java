package com.powerpulse.reading;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mongodb.client.result.UpdateResult;
import com.powerpulse.alert.AlertService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.fault.FaultDetectionService;
import com.powerpulse.fault.FaultEvaluation;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import com.powerpulse.transformer.TransformerStateService;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class ReadingIngestionServiceTest {

    private TransformerRepository transformers;
    private SensorReadingRepository readings;
    private MongoTemplate mongo;
    private FaultDetectionService detector;
    private AlertService alerts;
    private TransformerStateService state;
    private ReadingIngestionService service;
    private final Transformer t = transformer("t1", "PP-TX-001");

    @BeforeEach
    void setUp() {
        transformers = mock(TransformerRepository.class);
        readings = mock(SensorReadingRepository.class);
        mongo = mock(MongoTemplate.class);
        detector = mock(FaultDetectionService.class);
        alerts = mock(AlertService.class);
        state = mock(TransformerStateService.class);
        SettingsService settings = mock(SettingsService.class);
        when(settings.current()).thenReturn(new SystemSettings());
        when(transformers.findById("t1")).thenReturn(Optional.of(t));
        when(transformers.findByCode("PP-TX-001")).thenReturn(Optional.of(t));
        when(readings.insert(any(SensorReading.class))).thenAnswer(inv -> {
            SensorReading r = inv.getArgument(0);
            r.setId("r1");
            return r;
        });
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Transformer.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));
        when(detector.evaluate(any(), any(), any())).thenReturn(new FaultEvaluation(java.util.List.of(),
                java.util.EnumSet.allOf(FaultType.class)));
        service = new ReadingIngestionService(transformers, readings, mongo, detector, alerts, state, settings,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ReadingInput input(String id, String code) {
        return new ReadingInput(id, code, 60.0, 90.0, 415.0, 300.0, 50.0, 0.95, null);
    }

    @Test
    void pipelineRunsInOrder() {
        ReadingDto dto = service.ingest(input(null, "PP-TX-001"), ReadingSource.SIMULATED, "run-1", "low-oil");
        InOrder order = inOrder(readings, mongo, detector, alerts, state);
        order.verify(readings).insert(any(SensorReading.class));
        order.verify(mongo).updateFirst(any(Query.class), any(Update.class), eq(Transformer.class));
        order.verify(detector).evaluate(eq(t), any(ReadingSnapshot.class), any(SystemSettings.class));
        order.verify(alerts).reconcile(eq(t), any(FaultEvaluation.class), any(ReadingSnapshot.class));
        order.verify(state).refresh("t1");
        assertThat(dto.id()).isEqualTo("r1");
        assertThat(dto.source()).isEqualTo(ReadingSource.SIMULATED);
        assertThat(dto.simulationId()).isEqualTo("run-1");
        assertThat(dto.scenario()).isEqualTo("low-oil");
        assertThat(dto.recordedAt()).isEqualTo(NOW);
        assertThat(t.getLatestReading().getTemperatureC()).isEqualTo(60.0);
    }

    @Test
    void deviceReadingsNeverCarrySimulationLabels() {
        ReadingDto dto = service.ingest(input("t1", null), ReadingSource.DEVICE, "run-1", "low-oil");
        assertThat(dto.simulationId()).isNull();
        assertThat(dto.scenario()).isNull();
    }

    @Test
    void futureTimestampsAreClampedToNow() {
        ReadingInput in = new ReadingInput("t1", null, 60.0, 90.0, 415.0, 300.0, 50.0, 0.95, NOW.plusSeconds(3600));
        assertThat(service.ingest(in, ReadingSource.DEVICE, null, null).recordedAt()).isEqualTo(NOW);
    }

    @Test
    void impossibleValuesAreAcceptedAndPassedToDetection() {
        ReadingInput in = new ReadingInput("t1", null, 999.0, -5.0, null, 300.0, 50.0, 0.95, null);
        ReadingDto dto = service.ingest(in, ReadingSource.DEVICE, null, null);
        assertThat(dto.temperatureC()).isEqualTo(999.0);
        verify(detector).evaluate(eq(t), any(), any());
    }

    @Test
    void missingTransformerReferenceIs400AndUnknownIs404() {
        assertThatThrownBy(() -> service.ingest(input(null, " "), ReadingSource.DEVICE, null, null))
                .isInstanceOf(BadRequestException.class);
        when(transformers.findById("nope")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.ingest(input("nope", null), ReadingSource.DEVICE, null, null))
                .isInstanceOf(NotFoundException.class);
        verify(readings, never()).insert(any(SensorReading.class));
    }

    @Test
    void olderReadingIsStoredButDoesNotDriveLiveState() {
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Transformer.class)))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));
        service.ingest(input("t1", null), ReadingSource.DEVICE, null, null);
        verify(readings).insert(any(SensorReading.class));
        verify(alerts, never()).reconcile(any(), any(), any());
        verify(state, never()).refresh(any());
    }
}
