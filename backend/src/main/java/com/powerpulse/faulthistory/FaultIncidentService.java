package com.powerpulse.faulthistory;

import com.powerpulse.alert.Alert;
import com.powerpulse.reading.ReadingSnapshot;

/**
 * Maintains the immutable fault-history record that mirrors each alert 1:1 (unique alertId).
 * Called by the alert module; implemented in the faulthistory module. All methods are idempotent.
 */
public interface FaultIncidentService {

    /** Creates the incident when an alert opens (no-op if it already exists). */
    void openFor(Alert alert, ReadingSnapshot openingReading);

    /** Updates peak value/severity and appends the reading (bounded list) when the alert worsens. */
    void recordPeak(Alert alert, ReadingSnapshot reading);

    /** Finalizes resolvedAt, duration, resolution notes and actions taken when the alert resolves. */
    void finalizeFor(Alert alert);

    /** Links a maintenance task to the incident of the given alert. */
    void linkMaintenance(String alertId, String maintenanceId);
}
