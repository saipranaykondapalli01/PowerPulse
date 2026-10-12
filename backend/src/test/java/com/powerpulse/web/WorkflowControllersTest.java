package com.powerpulse.web;

import static com.powerpulse.support.TestAuth.auth;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.audit.AdminAuditController;
import com.powerpulse.audit.AuditLogQueryService;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.ForbiddenException;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.dashboard.DashboardController;
import com.powerpulse.dashboard.DashboardService;
import com.powerpulse.dashboard.HealthBucket;
import com.powerpulse.faulthistory.FaultHistoryController;
import com.powerpulse.faulthistory.FaultHistoryService;
import com.powerpulse.maintenance.MaintenanceController;
import com.powerpulse.maintenance.MaintenanceCreateRequest;
import com.powerpulse.maintenance.MaintenanceDto;
import com.powerpulse.maintenance.MaintenanceService;
import com.powerpulse.maintenance.MaintenanceStatus;
import com.powerpulse.maintenance.Priority;
import com.powerpulse.notification.NotificationController;
import com.powerpulse.notification.NotificationInboxService;
import com.powerpulse.notification.UnreadCount;
import com.powerpulse.reports.CsvExportService;
import com.powerpulse.reports.ReportController;
import com.powerpulse.reports.ReportService;
import com.powerpulse.support.MethodSecurityTestConfig;
import com.powerpulse.user.Role;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@WebMvcTest(controllers = {MaintenanceController.class, NotificationController.class, ReportController.class,
        AdminAuditController.class, DashboardController.class, FaultHistoryController.class})
@Import(MethodSecurityTestConfig.class)
class WorkflowControllersTest {

    @Autowired MockMvc mvc;

    @MockitoBean MaintenanceService maintenanceService;
    @MockitoBean NotificationInboxService inbox;
    @MockitoBean ReportService reportService;
    @MockitoBean CsvExportService csvExportService;
    @MockitoBean AuditLogQueryService auditLogQueryService;
    @MockitoBean DashboardService dashboardService;
    @MockitoBean FaultHistoryService faultHistoryService;

    private static final String CREATE_BODY = """
            {"transformerId":"t-1","title":"Inspect fans","priority":"HIGH",
             "assignedTechnicianId":"tech-1","dueDate":"2030-01-01T00:00:00Z"}""";

    private static MaintenanceDto dto() {
        Instant now = Instant.parse("2026-10-01T10:00:00Z");
        return new MaintenanceDto("m-1", "t-1", "PP-TX-001", "Main St", "North Ridge", null, "Inspect fans", null,
                Priority.HIGH, MaintenanceStatus.ASSIGNED, "tech-1", "Tess Tech", Instant.parse("2030-01-01T00:00:00Z"),
                false, null, List.of(), List.of(), null, null, null, "eng-1", "Erin", List.of(), now, now);
    }

    // ------------------------------------------------------------ maintenance

    @Test
    void createAsEngineerReturns201WithContractShape() throws Exception {
        when(maintenanceService.create(any())).thenReturn(dto());
        mvc.perform(post("/api/v1/maintenance").with(csrf()).with(authentication(auth("eng-1", Role.ENGINEER)))
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("m-1"))
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.overdue").value(false))
                .andExpect(jsonPath("$.dueDate").value("2030-01-01T00:00:00Z"))
                .andExpect(jsonPath("$.workNotes").isArray());
        ArgumentCaptor<MaintenanceCreateRequest> captor = ArgumentCaptor.forClass(MaintenanceCreateRequest.class);
        verify(maintenanceService).create(captor.capture());
        assertThat(captor.getValue().assignedTechnicianId()).isEqualTo("tech-1");
    }

    @Test
    void createIsForbiddenForTechniciansAndOperators() throws Exception {
        for (Role role : List.of(Role.TECHNICIAN, Role.OPERATOR)) {
            mvc.perform(post("/api/v1/maintenance").with(csrf()).with(authentication(auth("u-1", role)))
                            .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        verifyNoInteractions(maintenanceService);
    }

    @Test
    void createValidatesBody() throws Exception {
        mvc.perform(post("/api/v1/maintenance").with(csrf()).with(authentication(auth("eng-1", Role.ENGINEER)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"transformerId\":\"t-1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void patchMapsServiceErrors() throws Exception {
        when(maintenanceService.update(eq("m-1"), any())).thenThrow(new ConflictException("Task is COMPLETED"));
        when(maintenanceService.update(eq("m-2"), any())).thenThrow(new ForbiddenException("not yours"));
        mvc.perform(patch("/api/v1/maintenance/m-1").with(csrf()).with(authentication(auth("t-1", Role.TECHNICIAN)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"addWorkNote\":\"hi\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
        mvc.perform(patch("/api/v1/maintenance/m-2").with(csrf()).with(authentication(auth("t-1", Role.TECHNICIAN)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"addWorkNote\":\"hi\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/maintenance/m-1").with(csrf()).with(authentication(auth("o-1", Role.OPERATOR)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"addWorkNote\":\"hi\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/maintenance/m-1").with(csrf()).with(authentication(auth("e-1", Role.ENGINEER)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"addPart\":{\"name\":\"\",\"quantity\":0}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listPassesFiltersAndPaging() throws Exception {
        when(maintenanceService.list(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.of(List.of(dto()), 1, 5, 6));
        mvc.perform(get("/api/v1/maintenance").with(authentication(auth("t-1", Role.TECHNICIAN)))
                        .param("overdue", "true").param("status", "ASSIGNED")
                        .param("page", "1").param("size", "5").param("sort", "priority,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("m-1"))
                .andExpect(jsonPath("$.totalElements").value(6))
                .andExpect(jsonPath("$.totalPages").value(2));
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(maintenanceService).list(isNull(), eq(MaintenanceStatus.ASSIGNED), isNull(), isNull(), isNull(),
                eq(true), isNull(), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(5);
        assertThat(pageable.getValue().getSort().getOrderFor("priority").getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    // ------------------------------------------------------------ notifications

    @Test
    void notificationEndpoints() throws Exception {
        when(inbox.unreadCount()).thenReturn(new UnreadCount(3));
        when(inbox.markRead("n-x")).thenThrow(new NotFoundException("Notification", "n-x"));
        mvc.perform(get("/api/v1/notifications/unread-count").with(authentication(auth("u-1", Role.OPERATOR))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3));
        mvc.perform(patch("/api/v1/notifications/n-x/read").with(csrf()).with(authentication(auth("u-1", Role.OPERATOR))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(post("/api/v1/notifications/read-all").with(csrf()).with(authentication(auth("u-1", Role.TECHNICIAN))))
                .andExpect(status().isNoContent());
        verify(inbox).markAllRead();
    }

    // ------------------------------------------------------------ reports & CSV

    @Test
    void csvExportStreamsWithHeaders() throws Exception {
        StreamingResponseBody body = out -> out.write("code,name\r\n".getBytes(StandardCharsets.UTF_8));
        when(csvExportService.prepare(any(), any(), any(), any(), any())).thenReturn(body);
        MvcResult started = mvc.perform(get("/api/v1/reports/export.csv").param("type", "transformer-health")
                        .with(authentication(auth("o-1", Role.OPERATOR))))
                .andExpect(request().asyncStarted())
                .andReturn();
        mvc.perform(asyncDispatch(started))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString(
                        "powerpulse-transformer-health-" + LocalDate.now(ZoneOffset.UTC) + ".csv")))
                .andExpect(content().string("code,name\r\n"));
    }

    @Test
    void csvExportRejectsUnknownTypeAndTechnicians() throws Exception {
        mvc.perform(get("/api/v1/reports/export.csv").param("type", "users")
                        .with(authentication(auth("a-1", Role.ADMIN))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        mvc.perform(get("/api/v1/reports/export.csv").param("type", "maintenance")
                        .with(authentication(auth("t-1", Role.TECHNICIAN))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/reports/summary").with(authentication(auth("t-1", Role.TECHNICIAN))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(csvExportService, reportService);
    }

    // ------------------------------------------------------------ admin audit & dashboard

    @Test
    void auditLogsAreAdminOnly() throws Exception {
        when(auditLogQueryService.search(any(), any(), any(), any(), any(), any()))
                .thenReturn(PageResponse.of(List.of(), 0, 20, 0));
        mvc.perform(get("/api/v1/admin/audit-logs").with(authentication(auth("e-1", Role.ENGINEER))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/audit-logs").param("actor", "ada").param("from", "2026-01-01T00:00:00Z")
                        .with(authentication(auth("a-1", Role.ADMIN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
        verify(auditLogQueryService).search(eq("ada"), isNull(), isNull(), eq(Instant.parse("2026-01-01T00:00:00Z")),
                isNull(), any());
    }

    @Test
    void dashboardIsAvailableToAllRoles() throws Exception {
        when(dashboardService.healthDistribution(any())).thenReturn(List.of(new HealthBucket("80-100", 80, 100, 4)));
        mvc.perform(get("/api/v1/dashboard/health-distribution").with(authentication(auth("t-1", Role.TECHNICIAN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].range").value("80-100"))
                .andExpect(jsonPath("$[0].count").value(4));
    }
}
