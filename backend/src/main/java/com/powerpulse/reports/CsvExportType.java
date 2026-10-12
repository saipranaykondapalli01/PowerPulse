package com.powerpulse.reports;

import com.powerpulse.common.BadRequestException;

/** Mirrors {@code CsvExportType} in frontend/src/types/api.ts. */
public enum CsvExportType {
    TRANSFORMER_HEALTH("transformer-health"),
    FAULT_HISTORY("fault-history"),
    MAINTENANCE("maintenance"),
    READINGS("readings");

    private final String key;

    CsvExportType(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    public static CsvExportType parse(String value) {
        if (value != null) {
            for (CsvExportType t : values()) {
                if (t.key.equalsIgnoreCase(value.trim())) {
                    return t;
                }
            }
        }
        throw new BadRequestException(
                "type must be one of transformer-health, fault-history, maintenance, readings");
    }
}
