package com.powerpulse.audit;

import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.domain.ResourceType;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Persists audit entries. Auditing is best-effort: a failure is logged and never propagated to the
 * business operation that triggered it.
 */
@Service
public class AuditServiceImpl implements AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditServiceImpl.class);
    private static final int MAX_SUMMARY = 1000;

    private final AuditLogRepository repository;

    public AuditServiceImpl(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Override
    public void record(String action, ResourceType entityType, String entityId, String summary) {
        try {
            AuditLog entry = new AuditLog();
            entry.setActorId(CurrentUser.idOrNull());
            entry.setActorName(CurrentUser.nameOrSystem());
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setSummary(summary != null && summary.length() > MAX_SUMMARY
                    ? summary.substring(0, MAX_SUMMARY) : summary);
            entry.setAt(Instant.now());
            repository.save(entry);
        } catch (RuntimeException e) {
            log.warn("Failed to record audit entry {} for {} {}: {}", action, entityType, entityId, e.getMessage());
        }
    }
}
