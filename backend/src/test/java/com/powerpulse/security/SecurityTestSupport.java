package com.powerpulse.security;

import static org.mockito.Mockito.when;

import com.powerpulse.audit.AuditService;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Shared mocks and helpers for security slice tests. Subclasses declare {@code @WebMvcTest},
 * {@code @Import(SECURITY_BEANS...)} and {@code @ActiveProfiles("test")}.
 */
public abstract class SecurityTestSupport {

    public static final String CSRF_VALUE = "test-csrf-token-value";

    @MockitoBean
    protected UserRepository userRepository;

    @MockitoBean
    protected DeviceRepository deviceRepository;

    @MockitoBean
    protected AuditService auditService;

    @Autowired
    protected JwtService jwtService;

    protected User user(String id, Role role, boolean active) {
        User user = new User();
        user.setId(id);
        user.setName("User " + id);
        user.setEmail(id + "@powerpulse.local");
        user.setRole(role);
        user.setActive(active);
        user.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        user.setUpdatedAt(Instant.parse("2026-01-02T00:00:00Z"));
        return user;
    }

    /** Stubs the repository so the JWT filter can load the user, and returns a valid auth cookie for them. */
    protected Cookie loginCookie(User user) {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        return new Cookie(AuthCookies.TOKEN_COOKIE, jwtService.issue(user.getId(), user.getRole()));
    }

    protected static Cookie csrfCookie() {
        return new Cookie("XSRF-TOKEN", CSRF_VALUE);
    }
}
