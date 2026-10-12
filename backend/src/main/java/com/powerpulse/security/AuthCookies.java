package com.powerpulse.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** Builds the {@code pp_token} auth cookie (HttpOnly, SameSite=Lax, Path=/, Secure per configuration). */
@Component
public class AuthCookies {

    public static final String TOKEN_COOKIE = "pp_token";

    private final boolean secure;

    public AuthCookies(PowerPulseSecurityProperties properties) {
        this.secure = properties.cookieSecure();
    }

    public ResponseCookie tokenCookie(String token, Duration maxAge) {
        return base(token).maxAge(maxAge).build();
    }

    public ResponseCookie expiredTokenCookie() {
        return base("").maxAge(Duration.ZERO).build();
    }

    public static String readToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(TOKEN_COOKIE, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/");
    }
}
