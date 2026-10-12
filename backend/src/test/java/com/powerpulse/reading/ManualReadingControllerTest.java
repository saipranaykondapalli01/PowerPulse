package com.powerpulse.reading;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.MethodSecurityTestConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ManualReadingController.class)
@Import(MethodSecurityTestConfig.class)
@ActiveProfiles("test")
class ManualReadingControllerTest {

    private static final String URL = "/api/v1/transformers/t1/readings";
    private static final String VALID = """
            {"temperatureC":71.5,"oilLevelPct":88,"voltageV":414,"currentA":420,"loadPct":63,"powerFactor":0.93}""";

    @Autowired
    private MockMvc mvc;
    @MockitoBean
    private ManualReadingService manualReadingService;

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void technicianRecordsReading() throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isCreated());
        verify(manualReadingService).record(eq("t1"), any());
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void engineerRecordsReading() throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotRecordReading() throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isForbidden());
        verify(manualReadingService, never()).record(any(), any());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void impossibleValuesAreRejectedNotFlaggedAsSensorFailure() throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"temperatureC\":900,\"oilLevelPct\":120,\"voltageV\":414,\"currentA\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='temperatureC')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='oilLevelPct')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='currentA')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='loadPct')]").exists());
        verify(manualReadingService, never()).record(any(), any());
    }
}
