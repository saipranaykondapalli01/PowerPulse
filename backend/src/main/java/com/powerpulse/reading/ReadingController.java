package com.powerpulse.reading;

import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import com.powerpulse.reading.ReadingDtos.ReadingInput;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Device ingestion endpoint. Authentication (X-Device-Key) is enforced by the dedicated device filter chain in the
 * security module, so no role annotation applies here.
 */
@RestController
@RequestMapping("/api/v1/readings")
public class ReadingController {

    private final ReadingIngestionService ingestionService;

    public ReadingController(ReadingIngestionService ingestionService) {
        this.ingestionService = ingestionService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReadingDto ingest(@RequestBody ReadingInput input) {
        return ingestionService.ingest(input, ReadingSource.DEVICE, null, null);
    }
}
