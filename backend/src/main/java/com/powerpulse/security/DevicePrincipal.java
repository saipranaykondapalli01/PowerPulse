package com.powerpulse.security;

/** Principal for requests authenticated with an {@code X-Device-Key} (authority {@code ROLE_DEVICE}). */
public record DevicePrincipal(String id, String name) {
}
