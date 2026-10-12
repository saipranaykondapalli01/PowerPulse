package com.powerpulse.transformer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.MethodSecurityTestConfig;
import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.reading.ReadingController;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingIngestionService;
import com.powerpulse.simulation.SimulationController;
import com.powerpulse.simulation.SimulationService;
import com.powerpulse.transformer.TransformerDtos.NetworkPreviewNode;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = {TransformerController.class, PublicController.class, ReadingController.class,
        SimulationController.class})
@Import(MethodSecurityTestConfig.class)
@ActiveProfiles("test")
class WebControllersTest {

    private static final String VALID = """
            {"code":"PP-TX-100","name":"New","location":"Eastfield","ratedCapacityKva":400,
             "primaryVoltageKv":11,"secondaryVoltageV":415}""";

    @Autowired
    private MockMvc mvc;
    @MockitoBean
    private TransformerService transformerService;
    @MockitoBean
    private ReadingIngestionService ingestionService;
    @MockitoBean
    private SimulationService simulationService;

    @Test
    @WithMockUser(roles = "ENGINEER")
    void engineerCreatesTransformer() throws Exception {
        mvc.perform(post("/api/v1/transformers").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isCreated());
        verify(transformerService).create(any());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotCreateTransformer() throws Exception {
        mvc.perform(post("/api/v1/transformers").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isForbidden());
        verify(transformerService, never()).create(any());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void createValidatesFields() throws Exception {
        mvc.perform(post("/api/v1/transformers").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"bad code\",\"location\":\"X\",\"ratedCapacityKva\":0,"
                                + "\"primaryVoltageKv\":11,\"secondaryVoltageV\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='code')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='name')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='ratedCapacityKva')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='secondaryVoltageV')]").exists());
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void patchIsPartialButStillValidatesProvidedFields() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/transformers/t1")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed\"}"))
                .andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/transformers/t1")
                        .with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"ratedCapacityKva\":-5}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void publicPreviewIsMarkedSimulated() throws Exception {
        when(transformerService.networkPreview()).thenReturn(List.of(new NetworkPreviewNode("t1", "PP-TX-001", "A",
                "North Ridge", 1, 2, List.of(), TransformerStatus.HEALTHY, 98, 50.0, 60.0, 90.0, 415.0, 300.0, 500,
                0, true)));
        mvc.perform(get("/api/v1/public/network-preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].simulated").value(true))
                .andExpect(jsonPath("$[0].code").value("PP-TX-001"));
    }

    @Test
    @WithMockUser
    void readingIngestReturns201() throws Exception {
        when(ingestionService.ingest(any(), eq(ReadingSource.DEVICE), any(), any())).thenReturn(new ReadingDto("r1",
                "t1", 60.0, 90.0, 415.0, 300.0, 50.0, 0.95, ReadingSource.DEVICE, null, null, Instant.now()));
        mvc.perform(post("/api/v1/readings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transformerCode\":\"PP-TX-001\",\"temperatureC\":60,\"oilLevelPct\":90,"
                                + "\"voltageV\":415,\"currentA\":300,\"loadPct\":50}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("DEVICE"));
    }

    @Test
    @WithMockUser
    void readingWithNonNumericValueIs400() throws Exception {
        mvc.perform(post("/api/v1/readings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transformerCode\":\"PP-TX-001\",\"temperatureC\":\"hot\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    @WithMockUser
    void readingWithoutTransformerReferenceIs400() throws Exception {
        when(ingestionService.ingest(any(), any(), any(), any()))
                .thenThrow(new BadRequestException("transformerId or transformerCode is required"));
        mvc.perform(post("/api/v1/readings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"temperatureC\":60}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void simulationStatusForAllButControlForAdminEngineer() throws Exception {
        mvc.perform(get("/api/v1/simulation/status")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/simulation/start").with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/simulation/scenarios/low-oil").param("transformerId", "t1").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void unknownScenarioIs400() throws Exception {
        when(simulationService.applyScenario("meltdown", "t1")).thenThrow(new BadRequestException("Unknown scenario"));
        mvc.perform(post("/api/v1/simulation/scenarios/meltdown").param("transformerId", "t1").with(csrf()))
                .andExpect(status().isBadRequest());
    }
}
