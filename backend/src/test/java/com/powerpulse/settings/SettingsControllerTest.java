package com.powerpulse.settings;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.MethodSecurityTestConfig;
import com.powerpulse.audit.AuditService;
import com.powerpulse.common.domain.ResourceType;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SettingsController.class)
@Import({MethodSecurityTestConfig.class, SettingsServiceImpl.class})
@ActiveProfiles("test")
class SettingsControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private SystemSettingsRepository repository;

    @MockitoBean
    private AuditService auditService;

    @BeforeEach
    void setUp() {
        when(repository.findById(SystemSettings.GLOBAL_ID)).thenReturn(Optional.of(new SystemSettings()));
        when(repository.save(any(SystemSettings.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void engineerCanRead() throws Exception {
        mvc.perform(get("/api/v1/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.thresholds.temperatureC.warn").value(85.0))
                .andExpect(jsonPath("$.thresholds.oilLevelPct.critical").value(40.0))
                .andExpect(jsonPath("$.healthWeights.temperature").value(30.0))
                .andExpect(jsonPath("$.sensorTimeoutSeconds").value(120))
                .andExpect(jsonPath("$.locations.length()").value(5))
                .andExpect(jsonPath("$.simulation.intervalSeconds").value(10));
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotRead() throws Exception {
        mvc.perform(get("/api/v1/settings")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void engineerCannotUpdate() throws Exception {
        mvc.perform(patch("/api/v1/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sensorTimeoutSeconds\":60}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminPartialUpdateIsMergedAndAudited() throws Exception {
        mvc.perform(patch("/api/v1/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sensorTimeoutSeconds\":60,\"thresholds\":{\"temperatureC\":{\"warn\":80}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensorTimeoutSeconds").value(60))
                .andExpect(jsonPath("$.thresholds.temperatureC.warn").value(80.0))
                .andExpect(jsonPath("$.thresholds.temperatureC.critical").value(105.0))
                .andExpect(jsonPath("$.recoveryReadings").value(3))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        verify(auditService).record(eq("SETTINGS_UPDATED"), eq(ResourceType.SETTINGS), eq("global"), anyString());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void invalidUpdateReturnsFieldErrors() throws Exception {
        mvc.perform(patch("/api/v1/settings").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"healthWeights\":{\"temperature\":50},"
                                + "\"thresholds\":{\"oilLevelPct\":{\"warn\":30}}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='healthWeights')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='thresholds.oilLevelPct')]").exists());
        verify(repository, never()).save(any());
    }
}
