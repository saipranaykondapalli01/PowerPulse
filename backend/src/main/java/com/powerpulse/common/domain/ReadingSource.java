package com.powerpulse.common.domain;

public enum ReadingSource {
    SIMULATED,
    DEVICE,
    /** Entered by a signed-in user (e.g. a technician reading the meters on site). */
    MANUAL
}
