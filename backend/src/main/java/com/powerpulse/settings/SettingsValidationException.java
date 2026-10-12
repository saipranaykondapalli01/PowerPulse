package com.powerpulse.settings;

import com.powerpulse.common.ApiError;
import java.util.List;

/** Cross-field validation failure of a settings update; rendered as 400 VALIDATION_FAILED with fieldErrors. */
public class SettingsValidationException extends RuntimeException {

    private final List<ApiError.FieldError> fieldErrors;

    public SettingsValidationException(List<ApiError.FieldError> fieldErrors) {
        super("Request validation failed");
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public List<ApiError.FieldError> getFieldErrors() {
        return fieldErrors;
    }
}
