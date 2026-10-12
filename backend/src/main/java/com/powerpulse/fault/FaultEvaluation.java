package com.powerpulse.fault;

import com.powerpulse.common.domain.FaultType;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Result of evaluating one reading.
 *
 * @param findings  rule matches (at most one per fault type)
 * @param evaluated fault types whose rule was actually evaluated. A type that is evaluated but has no finding counts
 *                  as a "normal" evaluation for the recovery policy. Metrics invalidated by SENSOR_FAILURE are not
 *                  evaluated, so they neither open nor recover alerts.
 */
public record FaultEvaluation(List<FaultFinding> findings, Set<FaultType> evaluated) {

    public FaultEvaluation {
        findings = List.copyOf(findings);
        evaluated = evaluated.isEmpty() ? EnumSet.noneOf(FaultType.class) : EnumSet.copyOf(evaluated);
    }

    public Optional<FaultFinding> finding(FaultType type) {
        return findings.stream().filter(f -> f.faultType() == type).findFirst();
    }

    public boolean wasEvaluated(FaultType type) {
        return evaluated.contains(type);
    }
}
