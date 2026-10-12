package com.powerpulse.user;

/** Maps {@link User} documents to API DTOs. The password hash is never exposed. */
public final class UserMapper {

    private UserMapper() {
    }

    public static UserDto toDto(User user) {
        return new UserDto(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getRegion(),
                user.isActive(), user.getCreatedAt(), user.getUpdatedAt());
    }

    public static UserSummary toSummary(User user) {
        return new UserSummary(user.getId(), user.getName(), user.getRole(), user.getRegion());
    }
}
