package com.powerpulse.common;

import java.time.Instant;
import java.util.List;

/** Uniform error body returned for every non-2xx response. See docs/api-contracts.md. */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {
    }
}
