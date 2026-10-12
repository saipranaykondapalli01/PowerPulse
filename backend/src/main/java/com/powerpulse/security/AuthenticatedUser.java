package com.powerpulse.security;

import com.powerpulse.user.Role;

/**
 * Principal stored in the SecurityContext for authenticated users. Services obtain it through
 * {@link com.powerpulse.common.CurrentUser}.
 */
public record AuthenticatedUser(String id, String name, String email, Role role, String region) {

    public boolean hasRole(Role... roles) {
        for (Role r : roles) {
            if (r == role) {
                return true;
            }
        }
        return false;
    }
}
