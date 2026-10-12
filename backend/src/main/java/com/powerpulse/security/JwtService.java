package com.powerpulse.security;

import com.powerpulse.user.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Issues and validates the HS256 JWT stored in the {@code pp_token} cookie ({@code sub=userId}, {@code role}). */
@Service
public class JwtService {

    static final String ROLE_CLAIM = "role";

    private final SecretKey key;
    private final Duration expiry;
    private final Clock clock;

    @Autowired
    public JwtService(PowerPulseSecurityProperties properties) {
        this(properties, Clock.systemUTC());
    }

    JwtService(PowerPulseSecurityProperties properties, Clock clock) {
        this.key = Keys.hmacShaKeyFor(properties.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.expiry = Duration.ofMinutes(properties.jwt().expiryMinutes());
        this.clock = clock;
    }

    public Duration expiry() {
        return expiry;
    }

    public String issue(String userId, Role role) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(userId)
                .claim(ROLE_CLAIM, role.name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiry)))
                .signWith(key)
                .compact();
    }

    /** Returns the verified claims, or empty when the token is missing, malformed, tampered with or expired. */
    public Optional<TokenClaims> parse(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String subject = claims.getSubject();
            if (subject == null || subject.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(new TokenClaims(subject, claims.get(ROLE_CLAIM, String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public record TokenClaims(String userId, String role) {
    }
}
