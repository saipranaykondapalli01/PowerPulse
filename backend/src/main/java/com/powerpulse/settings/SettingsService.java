package com.powerpulse.settings;

/**
 * Read access to the {@link SystemSettings} singleton (created with defaults when absent).
 * Implemented in the settings module; the update API lives in the settings controller.
 */
public interface SettingsService {

    SystemSettings current();
}
