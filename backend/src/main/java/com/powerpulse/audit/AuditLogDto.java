package com.powerpulse.audit;

import com.powerpulse.common.domain.ResourceType;
import java.time.Instant;

/** Mirrors {@code AuditLogDto} in frontend/src/types/api.ts. */
public record AuditLogDto(
        String id,
        String actorId,
        String actorName,
        String action,
        ResourceType entityType,
        String entityId,
        String summary,
        Instant at) {

    public static AuditLogDto from(AuditLog log) {
        return new AuditLogDto(log.getId(), log.getActorId(), log.getActorName(), log.getAction(),
                log.getEntityType(), log.getEntityId(), log.getSummary(), log.getAt());
    }
}
