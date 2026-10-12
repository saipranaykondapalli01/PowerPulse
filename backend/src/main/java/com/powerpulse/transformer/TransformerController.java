package com.powerpulse.transformer;

import com.powerpulse.alert.AlertDto;
import com.powerpulse.common.PageResponse;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.transformer.TransformerDtos.OnCreate;
import com.powerpulse.transformer.TransformerDtos.TransformerDetailDto;
import com.powerpulse.transformer.TransformerDtos.TransformerDto;
import com.powerpulse.transformer.TransformerDtos.TransformerUpsertRequest;
import jakarta.validation.groups.Default;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transformers")
public class TransformerController {

    private final TransformerService transformerService;

    public TransformerController(TransformerService transformerService) {
        this.transformerService = transformerService;
    }

    @GetMapping
    public PageResponse<TransformerDto> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) TransformerStatus status,
            @RequestParam(required = false) Double minCapacity,
            @RequestParam(required = false) Double maxCapacity,
            @RequestParam(required = false) Integer minHealth,
            @RequestParam(required = false) Integer maxHealth,
            @PageableDefault(size = 20) Pageable pageable) {
        return transformerService.list(new TransformerService.TransformerFilter(q, location, status, minCapacity,
                maxCapacity, minHealth, maxHealth), pageable);
    }

    @GetMapping("/all")
    public List<TransformerDto> all() {
        return transformerService.all();
    }

    @GetMapping("/locations")
    public List<String> locations() {
        return transformerService.locations();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public TransformerDto create(@Validated({OnCreate.class, Default.class}) @RequestBody
                                 TransformerUpsertRequest request) {
        return transformerService.create(request);
    }

    @GetMapping("/{id}")
    public TransformerDetailDto get(@PathVariable String id) {
        return transformerService.detail(id);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public TransformerDto update(@PathVariable String id, @Validated @RequestBody TransformerUpsertRequest request) {
        return transformerService.update(id, request);
    }

    @GetMapping("/{id}/readings")
    public List<ReadingDto> readings(
            @PathVariable String id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Integer maxPoints) {
        return transformerService.readings(id, from, to, maxPoints);
    }

    @GetMapping("/{id}/alerts")
    public List<AlertDto> alerts(@PathVariable String id, @RequestParam(required = false) Boolean active) {
        return transformerService.alerts(id, active);
    }
}
