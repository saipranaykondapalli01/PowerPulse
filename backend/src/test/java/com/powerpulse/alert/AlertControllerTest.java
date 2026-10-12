package com.powerpulse.alert;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.MethodSecurityTestConfig;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.Severity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AlertController.class)
@Import(MethodSecurityTestConfig.class)
@ActiveProfiles("test")
class AlertControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AlertService alertService;

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void anyRoleCanListWithFilters() throws Exception {
        when(alertService.list(any(), any(Pageable.class))).thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0));
        mvc.perform(get("/api/v1/alerts").param("severity", "CRITICAL").param("active", "true")
                        .param("sort", "severity,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        verify(alertService).list(org.mockito.ArgumentMatchers.argThat(f -> f.severity() == Severity.CRITICAL
                && Boolean.TRUE.equals(f.active())), any(Pageable.class));
    }

    @Test
    @WithMockUser(roles = "TECHNICIAN")
    void technicianCannotAcknowledge() throws Exception {
        mvc.perform(post("/api/v1/alerts/a1/acknowledge").with(csrf()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verify(alertService, never()).acknowledge(any());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void operatorCannotResolve() throws Exception {
        mvc.perform(post("/api/v1/alerts/a1/resolve").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolutionNotes\":\"Fixed the fan\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ENGINEER")
    void resolveRequiresNotes() throws Exception {
        mvc.perform(post("/api/v1/alerts/a1/resolve").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolutionNotes\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("resolutionNotes"));
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void illegalTransitionIs409() throws Exception {
        when(alertService.acknowledge("a1")).thenThrow(new ConflictException("Only NEW alerts can be acknowledged"));
        mvc.perform(post("/api/v1/alerts/a1/acknowledge").with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void patchStatusValidatesEnum() throws Exception {
        mvc.perform(patch("/api/v1/alerts/a1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"BOGUS\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/alerts/a1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());
        verify(alertService).updateStatus(eq("a1"), any());
    }

    @Test
    @WithMockUser(roles = "OPERATOR")
    void assignRequiresUserId() throws Exception {
        mvc.perform(post("/api/v1/alerts/a1/assign").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
