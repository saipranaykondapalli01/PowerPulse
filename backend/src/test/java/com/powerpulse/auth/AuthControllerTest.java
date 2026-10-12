package com.powerpulse.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.security.AuthCookies;
import com.powerpulse.security.JwtService;
import com.powerpulse.security.SecurityConfig;
import com.powerpulse.security.SecurityTestSupport;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtService.class, AuthCookies.class, AuthService.class, LoginThrottle.class})
@ActiveProfiles("test")
class AuthControllerTest extends SecurityTestSupport {

    private static final String PASSWORD = "CorrectHorse42";
    private static final String HASH = new BCryptPasswordEncoder(4).encode(PASSWORD);

    @Autowired
    private MockMvc mvc;

    private User withCredentials(String id, String email, boolean active) {
        User user = user(id, Role.ENGINEER, active);
        user.setEmail(email);
        user.setPasswordHash(HASH);
        when(userRepository.findByEmailIgnoreCase(email)).thenReturn(Optional.of(user));
        return user;
    }

    private static String loginBody(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    @Test
    void loginSuccessSetsHttpOnlyCookieAndReturnsUserDto() throws Exception {
        withCredentials("u1", "eng@powerpulse.local", true);

        MvcResult result = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("ENG@PowerPulse.local", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u1"))
                .andExpect(jsonPath("$.email").value("eng@powerpulse.local"))
                .andExpect(jsonPath("$.role").value("ENGINEER"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(cookie().httpOnly(AuthCookies.TOKEN_COOKIE, true))
                .andExpect(cookie().path(AuthCookies.TOKEN_COOKIE, "/"))
                .andExpect(cookie().maxAge(AuthCookies.TOKEN_COOKIE, 480 * 60))
                .andReturn();

        String setCookie = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(h -> h.startsWith(AuthCookies.TOKEN_COOKIE + "=")).findFirst().orElseThrow();
        assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax").doesNotContain("Secure");
        String token = result.getResponse().getCookie(AuthCookies.TOKEN_COOKIE).getValue();
        assertThat(jwtService.parse(token)).get().extracting(JwtService.TokenClaims::userId).isEqualTo("u1");
        verify(auditService).record(eq("LOGIN_SUCCEEDED"), eq(ResourceType.USER), eq("u1"), anyString());
    }

    @Test
    void wrongPasswordReturnsGeneric401() throws Exception {
        withCredentials("u2", "wrong@powerpulse.local", true);

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("wrong@powerpulse.local", "NotThePassword1")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"))
                .andExpect(cookie().doesNotExist(AuthCookies.TOKEN_COOKIE));
        verify(auditService).record(eq("LOGIN_FAILED"), eq(ResourceType.USER), eq("u2"), contains("wrong password"));
    }

    @Test
    void unknownEmailReturnsSameGeneric401() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("nobody@powerpulse.local", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void inactiveUserCannotLogIn() throws Exception {
        withCredentials("u3", "inactive@powerpulse.local", false);

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("inactive@powerpulse.local", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"))
                .andExpect(cookie().doesNotExist(AuthCookies.TOKEN_COOKIE));
    }

    @Test
    void sixthAttemptAfterFiveFailuresIsThrottled() throws Exception {
        withCredentials("u4", "throttle@powerpulse.local", true);
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(loginBody("throttle@powerpulse.local", "BadPassword" + i)))
                    .andExpect(status().isUnauthorized());
        }
        // Even the correct password is refused while throttled.
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("throttle@powerpulse.local", PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"))
                .andExpect(cookie().doesNotExist(AuthCookies.TOKEN_COOKIE));
    }

    @Test
    void invalidLoginBodyReturnsValidationError() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(org.hamcrest.Matchers.hasItems("email", "password")));
        verify(userRepository, never()).findByEmailIgnoreCase(any());
    }

    @Test
    void meWithoutCookieReturns401Json() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("application/json")))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.path").value("/api/v1/auth/me"));
    }

    @Test
    void meWithValidCookieReturnsUser() throws Exception {
        User user = user("u5", Role.OPERATOR, true);
        user.setRegion("North Ridge");

        mvc.perform(get("/api/v1/auth/me").cookie(loginCookie(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("u5"))
                .andExpect(jsonPath("$.role").value("OPERATOR"))
                .andExpect(jsonPath("$.region").value("North Ridge"))
                .andExpect(jsonPath("$.createdAt").value("2026-01-01T00:00:00Z"));
    }

    @Test
    void invalidOrOrphanedCookieIsTreatedAsAnonymousAndCleared() throws Exception {
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie(AuthCookies.TOKEN_COOKIE, "garbage")))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().maxAge(AuthCookies.TOKEN_COOKIE, 0));

        // Valid signature but the user no longer exists.
        String token = jwtService.issue("ghost", Role.ADMIN);
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie(AuthCookies.TOKEN_COOKIE, token)))
                .andExpect(status().isUnauthorized());

        // Deactivated user.
        User inactive = user("u6", Role.ADMIN, false);
        mvc.perform(get("/api/v1/auth/me").cookie(loginCookie(inactive)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedRequestsDoNotRotateTheCsrfToken() throws Exception {
        // Regression: per-request JWT authentication must not be treated as a new login that
        // clears/rotates XSRF-TOKEN, or concurrent SPA mutations fail with 403.
        User user = user("u10", Role.ENGINEER, true);
        MvcResult result = mvc.perform(get("/api/v1/auth/me").cookie(loginCookie(user), csrfCookie()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .noneSatisfy(h -> assertThat(h).startsWith("XSRF-TOKEN="));
    }

    @Test
    void logoutWithoutCsrfHeaderIsForbiddenJson() throws Exception {
        User user = user("u7", Role.ENGINEER, true);
        mvc.perform(post("/api/v1/auth/logout").cookie(loginCookie(user)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Missing or invalid CSRF token"));

        // Mismatched header is also rejected.
        mvc.perform(post("/api/v1/auth/logout").cookie(loginCookie(user), csrfCookie())
                        .header("X-XSRF-TOKEN", "something-else"))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutWithMatchingCsrfCookieAndHeaderExpiresCookie() throws Exception {
        User user = user("u8", Role.ENGINEER, true);
        MvcResult result = mvc.perform(post("/api/v1/auth/logout").cookie(loginCookie(user), csrfCookie())
                        .header("X-XSRF-TOKEN", CSRF_VALUE))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(AuthCookies.TOKEN_COOKIE, 0))
                .andReturn();
        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        assertThat(setCookies).anySatisfy(h -> assertThat(h).startsWith("pp_token=;").contains("HttpOnly"));
    }

    @Test
    void csrfEndpointIssuesReadableXsrfCookie() throws Exception {
        MvcResult result = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isNoContent())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(cookie().httpOnly("XSRF-TOKEN", false))
                .andReturn();
        Cookie xsrf = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf.getPath()).isEqualTo("/");
        // CookieCsrfTokenRepository sets SameSite as a Servlet 6 cookie attribute (serialized by the container).
        assertThat(xsrf.getAttribute("SameSite")).isEqualTo("Lax");
        assertThat(xsrf.getSecure()).isFalse();
    }

    @Test
    void loginIsExemptFromCsrfButOtherMutationsAreNot() throws Exception {
        // Login without any CSRF token gets past the CSRF filter (401 from bad credentials, not 403).
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("csrf-check@powerpulse.local", "Whatever123")))
                .andExpect(status().isUnauthorized());
        verify(userRepository).findByEmailIgnoreCase("csrf-check@powerpulse.local");
    }
}
