package com.powerpulse.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Iterator;
import java.util.Optional;
import java.util.Set;

/**
 * Mirrors {@code UserUpdateRequest} in frontend/src/types/api.ts. All fields are optional (PATCH semantics:
 * absent or null means "unchanged"). {@code region} distinguishes the two: an absent property is {@code null}
 * (unchanged) while an explicit JSON {@code null} or a blank string is an empty Optional and clears the region
 * (meaning "all regions"). Unknown properties are rejected with 400.
 */
public record UserUpdateRequest(
        @Size(min = 2, max = 100) @Pattern(regexp = ".*\\S.*", message = "must not be blank") String name,
        Role role,
        Optional<@Size(max = 100) String> region,
        Boolean active,
        @Size(min = PasswordPolicy.MIN_LENGTH, max = PasswordPolicy.MAX_LENGTH)
        @Pattern(regexp = PasswordPolicy.PATTERN, message = PasswordPolicy.MESSAGE)
        String password) {

    private static final Set<String> FIELDS = Set.of("name", "role", "region", "active", "password");

    /** Jackson entry point. Type errors surface as 400 BAD_REQUEST ("Malformed request body"). */
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static UserUpdateRequest fromJson(JsonNode node) {
        if (node == null || !node.isObject()) {
            throw new IllegalArgumentException("Request body must be a JSON object");
        }
        for (Iterator<String> it = node.fieldNames(); it.hasNext(); ) {
            String field = it.next();
            if (!FIELDS.contains(field)) {
                throw new IllegalArgumentException("Unknown property: " + field);
            }
        }
        String roleText = text(node, "role");
        Role role = roleText == null ? null : Role.valueOf(roleText);
        Optional<String> region = node.has("region") ? Optional.ofNullable(text(node, "region")) : null;
        Boolean active = null;
        JsonNode activeNode = node.get("active");
        if (activeNode != null && !activeNode.isNull()) {
            if (!activeNode.isBoolean()) {
                throw new IllegalArgumentException("active must be a boolean");
            }
            active = activeNode.booleanValue();
        }
        return new UserUpdateRequest(text(node, "name"), role, region, active, text(node, "password"));
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isTextual()) {
            throw new IllegalArgumentException(field + " must be a string");
        }
        return value.textValue();
    }

    @Override
    public String toString() {
        return "UserUpdateRequest[name=" + name + ", role=" + role + ", region=" + region + ", active=" + active
                + ", password=" + (password == null ? "null" : "****") + "]";
    }
}
