package com.powerpulse.common;

import com.powerpulse.security.AuthenticatedUser;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Access to the authenticated user in service code. Scheduled jobs run without a user ("system"). */
public final class CurrentUser {

    public static final String SYSTEM = "system";

    private CurrentUser() {
    }

    public static Optional<AuthenticatedUser> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public static AuthenticatedUser require() {
        return get().orElseThrow(() -> new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                "UNAUTHORIZED", "Authentication required"));
    }

    public static String nameOrSystem() {
        return get().map(AuthenticatedUser::name).orElse(SYSTEM);
    }

    public static String idOrNull() {
        return get().map(AuthenticatedUser::id).orElse(null);
    }
}
