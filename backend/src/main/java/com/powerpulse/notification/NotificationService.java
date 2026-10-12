package com.powerpulse.notification;

import com.powerpulse.alert.Alert;
import com.powerpulse.maintenance.MaintenanceTask;
import com.powerpulse.transformer.Transformer;

/**
 * Creates persistent in-app notifications. Implementations resolve recipients (from
 * {@code SystemSettings.notifications} roles, region and assignment) and must be idempotent per event:
 * duplicates are prevented by the unique {@code (recipientId, dedupKey)} index.
 * Implemented in the notification module; called by the alert, fault and maintenance modules.
 */
public interface NotificationService {

    /** NEW_CRITICAL_ALERT when an alert is created at, or escalates to, CRITICAL. dedupKey: {@code critical:<alertId>}. */
    void notifyNewCriticalAlert(Alert alert);

    /** INCIDENT_RESOLVED when an alert is resolved (manually or automatically). dedupKey: {@code resolved:<alertId>}. */
    void notifyIncidentResolved(Alert alert);

    /** TRANSFORMER_OFFLINE when a STALE_READING alert opens. dedupKey: {@code offline:<staleAlertId>}. */
    void notifyTransformerOffline(Transformer transformer, Alert staleAlert);

    /** MAINTENANCE_ASSIGNED to the assigned technician. dedupKey: {@code assigned:<taskId>:<technicianId>}. */
    void notifyMaintenanceAssigned(MaintenanceTask task);
}
