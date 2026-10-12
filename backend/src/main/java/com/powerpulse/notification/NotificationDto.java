package com.powerpulse.notification;

import com.powerpulse.common.domain.ResourceType;
import java.time.Instant;

/** Mirrors {@code NotificationDto} in frontend/src/types/api.ts. */
public record NotificationDto(
        String id,
        String title,
        String message,
        NotificationType type,
        ResourceType relatedType,
        String relatedId,
        boolean read,
        Instant readAt,
        Instant createdAt) {

    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getTitle(), n.getMessage(), n.getType(), n.getRelatedType(),
                n.getRelatedId(), n.isRead(), n.getReadAt(), n.getCreatedAt());
    }
}
