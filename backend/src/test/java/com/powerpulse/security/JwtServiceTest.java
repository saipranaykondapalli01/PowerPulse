package com.powerpulse.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.powerpulse.user.Role;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-0123456789-abcdefghijklmnop";
    private static final Instant NOW = Instant.parse("2026-10-09T10:00:00Z");

    private static PowerPulseSecurityProperties props(String secret, long minutes) {
        return new PowerPulseSecurityProperties(new PowerPulseSecurityProperties.Jwt(secret, minutes), false);
    }

    private static JwtService at(Instant instant) {
        return new JwtService(props(SECRET, 480), Clock.fixed(instant, ZoneOffset.UTC));
    }

    @Test
    void roundTripReturnsSubjectAndRole() {
        JwtService service = at(NOW);
        String token = service.issue("user-1", Role.ENGINEER);

        var claims = service.parse(token);

        assertThat(claims).isPresent();
        assertThat(claims.get().userId()).isEqualTo("user-1");
        assertThat(claims.get().role()).isEqualTo("ENGINEER");
        assertThat(service.expiry()).isEqualTo(Duration.ofMinutes(480));
    }

    @Test
    void expiredTokenIsRejected() {
        String token = at(NOW).issue("user-1", Role.ADMIN);

        assertThat(at(NOW.plus(Duration.ofMinutes(479))).parse(token)).isPresent();
        assertThat(at(NOW.plus(Duration.ofMinutes(481))).parse(token)).isEmpty();
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService service = at(NOW);
        String token = service.issue("user-1", Role.OPERATOR);
        String[] parts = token.split("\\.");
        // Swap the payload for one claiming another subject, keeping the original signature.
        String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"admin\",\"role\":\"ADMIN\",\"exp\":9999999999}".getBytes());
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThat(service.parse(forged)).isEmpty();
        assertThat(service.parse(token.substring(0, token.length() - 2) + "xx")).isEmpty();
        assertThat(service.parse("not-a-jwt")).isEmpty();
        assertThat(service.parse("")).isEmpty();
        assertThat(service.parse(null)).isEmpty();
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        JwtService other = new JwtService(props("another-secret-0123456789-abcdefghijklmnop", 480),
                Clock.fixed(NOW, ZoneOffset.UTC));
        String token = other.issue("user-1", Role.ADMIN);

        assertThat(at(NOW).parse(token)).isEmpty();
    }

    @Test
    void shortOrBlankSecretFailsFast() {
        assertThatThrownBy(() -> props("too-short", 480))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes")
                .hasMessageNotContaining("too-short");
        assertThatThrownBy(() -> props("   ", 480)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> props(null, 480)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new PowerPulseSecurityProperties(null, true))
                .isInstanceOf(IllegalStateException.class);
    }
}
