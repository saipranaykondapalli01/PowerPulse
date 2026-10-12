package com.powerpulse.reading;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * Body of POST /transformers/{id}/readings: a meter reading entered by a signed-in user. Unlike device ingestion,
 * physically impossible values are rejected (they are typing mistakes, not sensor failures). Mirrors
 * {@code ManualReadingRequest} in frontend/src/types/api.ts.
 */
public record ManualReadingRequest(
        @NotNull @DecimalMin("-40") @DecimalMax("200") Double temperatureC,
        @NotNull @DecimalMin("0") @DecimalMax("100") Double oilLevelPct,
        @NotNull @DecimalMin("0") Double voltageV,
        @NotNull @DecimalMin("0") Double currentA,
        @NotNull @DecimalMin("0") @DecimalMax("300") Double loadPct,
        @DecimalMin("0") @DecimalMax("1") Double powerFactor,
        /** When the meter was read; defaults to now. Must not be in the future or older than 7 days. */
        Instant recordedAt,
        /** Exclude this transformer from the simulator so the entered value is not overwritten (default true). */
        Boolean holdFromSimulator,
        @Size(max = 200) String note) {
}
