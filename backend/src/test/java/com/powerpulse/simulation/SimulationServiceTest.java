package com.powerpulse.simulation;

import static com.powerpulse.TestData.NOW;
import static com.powerpulse.TestData.transformer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.reading.ReadingIngestionService;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerRepository;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class SimulationServiceTest {

    private SimulationStateRepository stateRepo;
    private MongoTemplate mongo;
    private TransformerRepository transformers;
    private ReadingIngestionService ingestion;
    private AuditService audit;
    private SystemSettings settings;
    private SimulationState state;
    private Transformer a;
    private Transformer b;

    @BeforeEach
    void setUp() {
        stateRepo = mock(SimulationStateRepository.class);
        mongo = mock(MongoTemplate.class);
        transformers = mock(TransformerRepository.class);
        ingestion = mock(ReadingIngestionService.class);
        audit = mock(AuditService.class);
        settings = new SystemSettings();
        state = new SimulationState();
        state.setRunning(true);
        state.setRunId("run-1");
        state.setScenarios(new HashMap<>());
        when(stateRepo.findById("global")).thenReturn(Optional.of(state));
        a = transformer("ta", "PP-TX-001");
        b = transformer("tb", "PP-TX-002");
        when(transformers.findAll(any(Sort.class))).thenReturn(List.of(a, b));
        when(transformers.findById("ta")).thenReturn(Optional.of(a));
    }

    private SimulationService service(boolean propertyEnabled) {
        SettingsService ss = mock(SettingsService.class);
        when(ss.current()).thenReturn(settings);
        return new SimulationService(stateRepo, mongo, transformers, ingestion, new SimulationEngine(), ss, audit,
                propertyEnabled, Clock.fixed(NOW, ZoneOffset.UTC), new Random(3));
    }

    private static ActiveScenario scenario(String name, int step) {
        ActiveScenario s = new ActiveScenario();
        s.setName(name);
        s.setStep(step);
        s.setStartedAt(NOW);
        return s;
    }

    @Test
    void tickIngestsOneSimulatedReadingPerTransformerAndSkipsOffline() {
        state.getScenarios().put("tb", scenario("offline", 0));
        int n = service(true).runTick();
        assertThat(n).isEqualTo(1);
        verify(ingestion).ingest(argThat(in -> "ta".equals(in.transformerId())), eq(ReadingSource.SIMULATED),
                eq("run-1"), isNull());
        verify(ingestion, never()).ingest(argThat(in -> "tb".equals(in.transformerId())), any(), any(), any());
        verify(mongo).upsert(any(Query.class), any(Update.class), eq(SimulationState.class));
    }

    @Test
    void scenarioNameIsRecordedAndStepAdvanced() {
        state.getScenarios().put("ta", scenario("critical-overheating", 0));
        service(true).runTick();
        verify(ingestion).ingest(argThat(in -> "ta".equals(in.transformerId()) && in.temperatureC() >= 105),
                eq(ReadingSource.SIMULATED), eq("run-1"), eq("critical-overheating"));
        verify(mongo).updateFirst(any(Query.class), argThat((Update u) -> u.getUpdateObject().toJson()
                .contains("scenarios.ta.step")), eq(SimulationState.class));
    }

    @Test
    void scheduledTickIsGatedByPropertySettingsRunningAndInterval() {
        assertThat(service(false).scheduledTick()).isFalse();
        settings.getSimulation().setEnabled(false);
        assertThat(service(true).scheduledTick()).isFalse();
        settings.getSimulation().setEnabled(true);
        state.setRunning(false);
        assertThat(service(true).scheduledTick()).isFalse();
        state.setRunning(true);
        state.setUpdatedAt(NOW.minusSeconds(2)); // interval 10 s not elapsed
        assertThat(service(true).scheduledTick()).isFalse();
        verify(ingestion, never()).ingest(any(), any(), any(), any());
        state.setUpdatedAt(NOW.minusSeconds(10));
        assertThat(service(true).scheduledTick()).isTrue();
        verify(ingestion, times(2)).ingest(any(), any(), any(), any());
    }

    @Test
    void unknownScenarioIs400AndUnknownTransformerIs404() {
        SimulationService s = service(true);
        assertThatThrownBy(() -> s.applyScenario("meltdown", "ta")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> s.applyScenario("low-oil", "missing")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> s.applyScenario("low-oil", null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void applyScenarioPersistsAndAudits() {
        state.getScenarios().put("ta", scenario("low-oil", 0));
        when(transformers.findAllById(any())).thenReturn(List.of(a));
        SimulationStatusDto status = service(true).applyScenario("low-oil", "ta");
        verify(mongo).upsert(any(Query.class), argThat((Update u) -> {
            Map<?, ?> set = (Map<?, ?>) u.getUpdateObject().get("$set");
            return set != null && set.get("scenarios.ta") instanceof ActiveScenario s && s.getName().equals("low-oil");
        }), eq(SimulationState.class));
        verify(audit).record(eq("SIMULATION_SCENARIO_APPLIED"), eq(ResourceType.SIMULATION), eq("ta"), anyString());
        assertThat(status.scenarios()).extracting(SimulationStatusDto.ActiveScenarioDto::transformerCode)
                .containsExactly("PP-TX-001");
        assertThat(status.availableScenarios()).contains("offline", "return-to-normal");
        assertThat(status.running()).isTrue();
        assertThat(status.enabled()).isTrue();
        assertThat(status.intervalSeconds()).isEqualTo(10);
    }

    @Test
    void controlsAreAudited() {
        SimulationService s = service(true);
        s.start();
        s.pause();
        s.reset();
        verify(audit).record(eq("SIMULATION_STARTED"), any(), any(), anyString());
        verify(audit).record(eq("SIMULATION_PAUSED"), any(), any(), anyString());
        verify(audit).record(eq("SIMULATION_RESET"), any(), any(), anyString());
        verify(mongo).upsert(any(Query.class), argThat((Update u) -> {
            Map<?, ?> set = (Map<?, ?>) u.getUpdateObject().get("$set");
            return set != null && set.containsKey("scenarios");
        }), eq(SimulationState.class));
    }
}
