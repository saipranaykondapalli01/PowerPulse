package com.powerpulse.maintenance;

import com.powerpulse.common.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Maintenance task API. Role checks are declared here; technician ownership and field-level permissions are
 * enforced in {@link MaintenanceService}.
 */
@RestController
@RequestMapping("/api/v1")
public class MaintenanceController {

    private final MaintenanceService service;

    public MaintenanceController(MaintenanceService service) {
        this.service = service;
    }

    @GetMapping("/maintenance")
    @PreAuthorize("isAuthenticated()")
    public PageResponse<MaintenanceDto> list(@RequestParam(required = false) String q,
                                             @RequestParam(required = false) MaintenanceStatus status,
                                             @RequestParam(required = false) Priority priority,
                                             @RequestParam(required = false) String technicianId,
                                             @RequestParam(required = false) String transformerId,
                                             @RequestParam(required = false) Boolean overdue,
                                             @RequestParam(required = false) Boolean upcoming,
                                             Pageable pageable) {
        return service.list(q, status, priority, technicianId, transformerId, overdue, upcoming, pageable);
    }

    @PostMapping("/maintenance")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public MaintenanceDto create(@Valid @RequestBody MaintenanceCreateRequest request) {
        return service.create(request);
    }

    @GetMapping("/maintenance/{id}")
    @PreAuthorize("isAuthenticated()")
    public MaintenanceDto get(@PathVariable String id) {
        return service.get(id);
    }

    @PatchMapping("/maintenance/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','TECHNICIAN')")
    public MaintenanceDto update(@PathVariable String id, @Valid @RequestBody MaintenanceUpdateRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/maintenance/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','TECHNICIAN')")
    public MaintenanceDto complete(@PathVariable String id,
                                   @Valid @RequestBody(required = false) MaintenanceCompleteRequest request) {
        return service.complete(id, request);
    }

    @GetMapping("/transformers/{id}/maintenance")
    @PreAuthorize("isAuthenticated()")
    public List<MaintenanceDto> forTransformer(@PathVariable String id) {
        return service.forTransformer(id);
    }
}
