package com.powerpulse.auth;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ApiException;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.security.AuthenticatedUser;
import com.powerpulse.security.JwtService;
import com.powerpulse.user.User;
import com.powerpulse.user.UserAdminService;
import com.powerpulse.user.UserDto;
import com.powerpulse.user.UserMapper;
import com.powerpulse.user.UserRepository;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String INVALID_CREDENTIALS = "Invalid email or password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginThrottle loginThrottle;
    private final AuditService auditService;
    /** Compared against when the email is unknown, so response time does not reveal which emails exist. */
    private final String dummyHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       LoginThrottle loginThrottle, AuditService auditService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginThrottle = loginThrottle;
        this.auditService = auditService;
        this.dummyHash = passwordEncoder.encode("timing-equalizer-not-a-real-password-1");
    }

    public LoginResult login(LoginRequest request) {
        String email = UserAdminService.normalizeEmail(request.email());
        if (loginThrottle.isBlocked(email)) {
            log.warn("Login throttled after repeated failures");
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS",
                    "Too many failed login attempts. Try again later.");
        }
        Optional<User> found = userRepository.findByEmailIgnoreCase(email);
        boolean passwordOk = passwordEncoder.matches(request.password(),
                found.map(User::getPasswordHash).filter(h -> h != null && !h.isEmpty()).orElse(dummyHash));
        if (found.isEmpty() || !passwordOk || !found.get().isActive() || found.get().getRole() == null) {
            loginThrottle.recordFailure(email);
            String reason = found.isEmpty() ? "unknown email" : !passwordOk ? "wrong password" : "inactive user";
            auditService.record("LOGIN_FAILED", ResourceType.USER, found.map(User::getId).orElse(null),
                    "Failed login for " + email + " (" + reason + ")");
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", INVALID_CREDENTIALS);
        }
        User user = found.get();
        loginThrottle.reset(email);
        // Populate the context for the rest of this (stateless) request so the audit entry names the actor.
        setAuthentication(user);
        auditService.record("LOGIN_SUCCEEDED", ResourceType.USER, user.getId(), "User " + user.getEmail() + " logged in");
        String token = jwtService.issue(user.getId(), user.getRole());
        return new LoginResult(UserMapper.toDto(user), token, jwtService.expiry());
    }

    public UserDto me() {
        AuthenticatedUser principal = CurrentUser.require();
        return userRepository.findById(principal.id())
                .filter(User::isActive)
                .map(UserMapper::toDto)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required"));
    }

    private static void setAuthentication(User user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getName(), user.getEmail(),
                user.getRole(), user.getRegion());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))));
        SecurityContextHolder.setContext(context);
    }

    /** Outcome of a successful login. The token is only ever written to the HttpOnly cookie. */
    public record LoginResult(UserDto user, String token, Duration maxAge) {

        @Override
        public String toString() {
            return "LoginResult[user=" + user + ", token=****, maxAge=" + maxAge + "]";
        }
    }
}
