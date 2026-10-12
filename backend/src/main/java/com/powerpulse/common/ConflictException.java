package com.powerpulse.common;

import org.springframework.http.HttpStatus;

/** Duplicate keys, illegal workflow transitions and similar state conflicts (HTTP 409). */
public class ConflictException extends ApiException {

    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, "CONFLICT", message);
    }
}
