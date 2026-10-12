package com.powerpulse.simulation;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/** Simulator scenarios (API names are the kebab-case {@link #slug()}). */
public enum Scenario {
    HEALTHY("healthy"),
    RISING_TEMPERATURE("rising-temperature"),
    LOW_OIL("low-oil"),
    OVERLOADING("overloading"),
    CRITICAL_OVERHEATING("critical-overheating"),
    OFFLINE("offline"),
    RETURN_TO_NORMAL("return-to-normal"),
    /** Readings are entered manually; the simulator skips this transformer so it never overwrites them. */
    MANUAL("manual");

    private final String slug;

    Scenario(String slug) {
        this.slug = slug;
    }

    public String slug() {
        return slug;
    }

    public static Optional<Scenario> fromSlug(String slug) {
        return Arrays.stream(values()).filter(s -> s.slug.equals(slug)).findFirst();
    }

    public static List<String> slugs() {
        return Arrays.stream(values()).map(Scenario::slug).toList();
    }
}
