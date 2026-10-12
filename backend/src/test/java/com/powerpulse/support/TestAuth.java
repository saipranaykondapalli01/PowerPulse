package com.powerpulse.support;

import com.powerpulse.security.AuthenticatedUser;
import com.powerpulse.user.Role;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/** Builds authentications whose principal is an {@link AuthenticatedUser} (as the real JWT filter does). */
public final class TestAuth {

    private TestAuth() {
    }

    public static Authentication auth(String id, String name, Role role, String region) {
        AuthenticatedUser user = new AuthenticatedUser(id, name, name.toLowerCase().replace(' ', '.') + "@test.local",
                role, region);
        return new UsernamePasswordAuthenticationToken(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
    }

    public static Authentication auth(String id, Role role) {
        return auth(id, role.name().charAt(0) + role.name().substring(1).toLowerCase() + " " + id, role, null);
    }

    /** Sets the current user for service-level tests. */
    public static void loginAs(String id, String name, Role role) {
        SecurityContextHolder.getContext().setAuthentication(auth(id, name, role, null));
    }

    public static void logout() {
        SecurityContextHolder.clearContext();
    }
}
