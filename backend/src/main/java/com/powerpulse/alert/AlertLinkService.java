package com.powerpulse.alert;

/**
 * Narrow API used by the maintenance module to link a task to an alert (adds the id to
 * {@code Alert.maintenanceIds}, appends a MAINTENANCE_LINKED event and links the fault incident).
 * Implemented in the alert module.
 */
public interface AlertLinkService {

    /** @throws com.powerpulse.common.NotFoundException if the alert does not exist */
    Alert linkMaintenance(String alertId, String maintenanceId);
}
