package com.powerpulse.alert;

import com.powerpulse.alert.AlertRequests.AlertAssignRequest;
import com.powerpulse.alert.AlertRequests.AlertResolveRequest;
import com.powerpulse.alert.AlertRequests.AlertUpdateRequest;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public PageResponse<AlertDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) AlertStatus status,
            @RequestParam(required = false) Severity severity,
            @RequestParam(required = false) FaultType faultType,
            @RequestParam(required = false) String transformerId,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @PageableDefault(size = 20) Pageable pageable) {
        return alertService.list(new AlertService.AlertFilter(q, status, severity, faultType, transformerId,
                location, active, from, to), pageable);
    }

    @GetMapping("/{id}")
    public AlertDto get(@PathVariable String id) {
        return alertService.get(id);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','OPERATOR')")
    public AlertDto update(@PathVariable String id, @Valid @RequestBody AlertUpdateRequest request) {
        return alertService.updateStatus(id, request);
    }

    @PostMapping("/{id}/acknowledge")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','OPERATOR')")
    public AlertDto acknowledge(@PathVariable String id) {
        return alertService.acknowledge(id);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','OPERATOR')")
    public AlertDto assign(@PathVariable String id, @Valid @RequestBody AlertAssignRequest request) {
        return alertService.assign(id, request);
    }

    @PostMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public AlertDto resolve(@PathVariable String id, @Valid @RequestBody AlertResolveRequest request) {
        return alertService.resolve(id, request);
    }
}
