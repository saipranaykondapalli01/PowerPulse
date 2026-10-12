package com.powerpulse.reading;

import com.powerpulse.reading.ReadingDtos.ReadingDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Manual meter readings entered by signed-in users (cookie auth + CSRF, unlike the device endpoint). */
@RestController
public class ManualReadingController {

    private final ManualReadingService manualReadingService;

    public ManualReadingController(ManualReadingService manualReadingService) {
        this.manualReadingService = manualReadingService;
    }

    @PostMapping("/api/v1/transformers/{id}/readings")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'ENGINEER', 'TECHNICIAN')")
    public ReadingDto record(@PathVariable String id, @Valid @RequestBody ManualReadingRequest request) {
        return manualReadingService.record(id, request);
    }
}
