package com.powerpulse.reports;

import com.powerpulse.common.domain.FaultType;

/** Mirrors {@code IncidentDurationRow} in frontend/src/types/api.ts. */
public record IncidentDurationRow(FaultType faultType, long count, Double averageSeconds, Long maxSeconds) {
}
