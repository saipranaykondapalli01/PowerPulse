package com.powerpulse.transformer;

import com.powerpulse.alert.Alert;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.transformer.TransformerDtos.Recommendation;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Rule-based suggested inspection actions derived from active alerts and the health score. These are suggestions to
 * guide an inspection, not a diagnosis.
 */
@Service
public class RecommendationService {

    static final int ROUTINE_INSPECTION_SCORE = 60;

    public List<Recommendation> recommend(int healthScore, List<Alert> activeAlerts) {
        List<Recommendation> out = new ArrayList<>();
        Set<FaultType> seen = EnumSet.noneOf(FaultType.class);
        List<Alert> ordered = activeAlerts.stream()
                .filter(Alert::isActive)
                .sorted(Comparator.comparing((Alert a) -> a.getSeverity() == null ? -1 : a.getSeverity().ordinal())
                        .reversed())
                .toList();
        for (Alert a : ordered) {
            if (a.getFaultType() != null && seen.add(a.getFaultType())) {
                out.add(forFault(a.getFaultType()));
            }
        }
        if (out.isEmpty() && healthScore < ROUTINE_INSPECTION_SCORE) {
            out.add(new Recommendation(null, "Suggested inspection: reduced health score",
                    "Schedule a routine inspection."));
        }
        return out;
    }

    static Recommendation forFault(FaultType type) {
        return switch (type) {
            case OVERHEATING -> new Recommendation(type, "Suggested inspection: overheating",
                    "Inspect cooling fins and fans; check for blocked radiators; verify load profile.");
            case LOW_OIL_LEVEL -> new Recommendation(type, "Suggested inspection: low oil level",
                    "Inspect for oil leaks at gaskets and valves; check the conservator and sight glass.");
            case OVERLOADING -> new Recommendation(type, "Suggested inspection: overloading",
                    "Review connected load; consider load transfer to adjacent transformer.");
            case ABNORMAL_VOLTAGE -> new Recommendation(type, "Suggested inspection: abnormal voltage",
                    "Check tap changer position and upstream supply voltage.");
            case ABNORMAL_CURRENT -> new Recommendation(type, "Suggested inspection: abnormal current",
                    "Check for phase imbalance or downstream faults.");
            case SENSOR_FAILURE -> new Recommendation(type, "Suggested inspection: sensor failure",
                    "Verify sensor wiring and calibration.");
            case STALE_READING -> new Recommendation(type, "Suggested inspection: no recent readings",
                    "Check gateway connectivity and power to the monitoring unit.");
        };
    }
}
