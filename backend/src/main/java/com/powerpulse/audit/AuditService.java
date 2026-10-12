package com.powerpulse.audit;

import com.powerpulse.common.domain.ResourceType;

/**
 * Records important actions. The actor is taken from {@link com.powerpulse.common.CurrentUser}
 * ("system" for scheduled jobs). Never pass passwords, hashes, tokens or device keys in the summary.
 */
public interface AuditService {

    void record(String action, ResourceType entityType, String entityId, String summary);
}
