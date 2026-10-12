package com.powerpulse.health;

import com.powerpulse.transformer.HealthFactor;
import com.powerpulse.transformer.TransformerStatus;
import java.util.List;

/**
 * Output of {@link TransformerHealthService#assess}. The score is a transparent prioritization heuristic, not a
 * statistically validated probability of failure.
 */
public record HealthAssessment(int score, List<HealthFactor> factors, TransformerStatus status, int activeFaultCount) {
}
