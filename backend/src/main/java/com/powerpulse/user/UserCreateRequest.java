package com.powerpulse.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Mirrors {@code UserCreateRequest} in frontend/src/types/api.ts. */
public record UserCreateRequest(
        @NotBlank @Size(min = 2, max = 100) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotNull
        @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH)
        @Pattern(regexp = PasswordPolicy.PATTERN, message = PasswordPolicy.MESSAGE)
        String password,
        @NotNull Role role,
        @Size(max = 100) String region) {

    @Override
    public String toString() {
        return "UserCreateRequest[name=" + name + ", email=" + email + ", password=****, role=" + role
                + ", region=" + region + "]";
    }
}
