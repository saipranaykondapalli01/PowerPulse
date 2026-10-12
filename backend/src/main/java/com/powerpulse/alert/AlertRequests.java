package com.powerpulse.alert;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies of the alert workflow API (mirrors of the TS request types). */
public final class AlertRequests {

    private AlertRequests() {
    }

    /** {@code AlertUpdateRequest}: forward-only status change (RESOLVED only via /resolve). */
    public record AlertUpdateRequest(@NotNull AlertStatus status) {
    }

    /** {@code AlertAssignRequest}. */
    public record AlertAssignRequest(@NotBlank String userId) {
    }

    /** {@code AlertResolveRequest}: notes are required (at least 5 characters, trimmed). */
    public record AlertResolveRequest(@NotBlank @Size(min = 5, max = 4000) String resolutionNotes) {
    }
}
