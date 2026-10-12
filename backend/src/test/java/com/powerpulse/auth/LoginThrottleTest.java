package com.powerpulse.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class LoginThrottleTest {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-09T10:00:00Z"));
    private final Clock clock = new Clock() {
        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    };
    private final LoginThrottle throttle = new LoginThrottle(clock);

    @Test
    void blocksAfterFiveFailuresWithinWindow() {
        for (int i = 0; i < 4; i++) {
            throttle.recordFailure("a@x.io");
        }
        assertThat(throttle.isBlocked("a@x.io")).isFalse();
        throttle.recordFailure("a@x.io");
        assertThat(throttle.isBlocked("a@x.io")).isTrue();
        assertThat(throttle.isBlocked("b@x.io")).isFalse();
    }

    @Test
    void failuresExpireAfterWindow() {
        for (int i = 0; i < 5; i++) {
            throttle.recordFailure("a@x.io");
        }
        now.set(now.get().plus(Duration.ofMinutes(15)).plusSeconds(1));
        assertThat(throttle.isBlocked("a@x.io")).isFalse();
    }

    @Test
    void resetClearsFailures() {
        for (int i = 0; i < 5; i++) {
            throttle.recordFailure("a@x.io");
        }
        throttle.reset("a@x.io");
        assertThat(throttle.isBlocked("a@x.io")).isFalse();
    }
}
