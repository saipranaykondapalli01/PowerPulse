package com.powerpulse.faulthistory;

import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("isAuthenticated()")
public class FaultHistoryController {

    private final FaultHistoryService service;

    public FaultHistoryController(FaultHistoryService service) {
        this.service = service;
    }

    @GetMapping("/fault-history")
    public PageResponse<FaultIncidentDto> search(
            @RequestParam(required = false) String transformerId,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) FaultType faultType,
            @RequestParam(required = false) Severity severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            Pageable pageable) {
        return service.search(transformerId, location, faultType, severity, from, to, pageable);
    }

    @GetMapping("/transformers/{id}/incidents")
    public List<FaultIncidentDto> forTransformer(@PathVariable String id) {
        return service.forTransformer(id);
    }
}
