package com.powerpulse.dashboard;

import com.powerpulse.common.domain.FaultType;

/** Mirrors {@code FaultFrequency} in frontend/src/types/api.ts (also used by the reports API). */
public record FaultFrequency(FaultType faultType, long count, long critical) {
}
