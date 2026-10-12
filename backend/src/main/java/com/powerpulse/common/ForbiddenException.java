package com.powerpulse.common;

import org.springframework.http.HttpStatus;

/** Service-level authorization failure (e.g. a technician touching another technician's task). */
public class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}
