package com.powerpulse.settings;

import com.powerpulse.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps {@link SettingsValidationException} to the standard {@link ApiError} body. Ordered before the global
 * handler (whose catch-all {@code Exception} handler would otherwise win).
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SettingsExceptionHandler {

    @ExceptionHandler(SettingsValidationException.class)
    public ResponseEntity<ApiError> handle(SettingsValidationException ex, HttpServletRequest req) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(new ApiError(Instant.now(), status.value(), status.getReasonPhrase(),
                "VALIDATION_FAILED", "Request validation failed", req.getRequestURI(), ex.getFieldErrors()));
    }
}
