package com.powerpulse.fault;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;

/**
 * One rule match produced by {@link FaultDetectionService}.
 *
 * @param measuredValue the value in {@code unit} (for ABNORMAL_VOLTAGE the voltage in V, for ABNORMAL_CURRENT the
 *                      current in A, for STALE_READING the reading age in seconds)
 * @param threshold     the configured bound that was crossed, in the same unit (warn bound for MEDIUM/HIGH, critical
 *                      bound for CRITICAL)
 */
public record FaultFinding(FaultType faultType, Severity severity, Double measuredValue, Double threshold, String unit,
                           String description) {
}
