package com.powerpulse.reports;

import com.powerpulse.dashboard.QuerySupport;
import java.time.Duration;
import java.time.Instant;

/** Report time window; defaults to the last 30 days ending now. */
public record ReportRange(Instant from, Instant to) {

    static final Duration DEFAULT_WINDOW = Duration.ofDays(30);

    public static ReportRange of(Instant from, Instant to) {
        Instant end = to != null ? to : Instant.now();
        Instant start = from != null ? from : end.minus(DEFAULT_WINDOW);
        QuerySupport.requireOrdered(start, end);
        return new ReportRange(start, end);
    }
}
