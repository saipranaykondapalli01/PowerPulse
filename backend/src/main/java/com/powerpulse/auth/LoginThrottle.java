package com.powerpulse.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * In-memory, per-instance brute-force guard: after {@value #MAX_FAILURES} failed logins for the same email
 * within {@link #WINDOW}, further attempts are rejected (HTTP 429) until the oldest failure leaves the window.
 * A successful login clears the counter.
 */
@Component
public class LoginThrottle {

    public static final int MAX_FAILURES = 5;
    public static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int PRUNE_THRESHOLD = 10_000;

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public LoginThrottle() {
        this(Clock.systemUTC());
    }

    LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    public boolean isBlocked(String key) {
        Deque<Instant> attempts = failures.get(key);
        if (attempts == null) {
            return false;
        }
        synchronized (attempts) {
            evictExpired(attempts, clock.instant());
            return attempts.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        Deque<Instant> attempts = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (attempts) {
            evictExpired(attempts, now);
            attempts.addLast(now);
        }
        if (failures.size() > PRUNE_THRESHOLD) {
            prune(now);
        }
    }

    public void reset(String key) {
        failures.remove(key);
    }

    private void prune(Instant now) {
        failures.entrySet().removeIf(entry -> {
            Deque<Instant> attempts = entry.getValue();
            synchronized (attempts) {
                evictExpired(attempts, now);
                return attempts.isEmpty();
            }
        });
    }

    private static void evictExpired(Deque<Instant> attempts, Instant now) {
        Instant cutoff = now.minus(WINDOW);
        while (!attempts.isEmpty() && !attempts.peekFirst().isAfter(cutoff)) {
            attempts.pollFirst();
        }
    }
}
