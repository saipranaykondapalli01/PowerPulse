package com.powerpulse.common.domain;

/** Ordered from least to most severe; compare with {@link #isHigherThan(Severity)}. */
public enum Severity {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL;

    public boolean isHigherThan(Severity other) {
        return other == null || this.ordinal() > other.ordinal();
    }
}
