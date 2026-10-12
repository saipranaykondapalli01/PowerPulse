package com.powerpulse.audit;

import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.ResourceType;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Read side of the audit log for the admin API (newest first). */
@Service
public class AuditLogQueryService {

    private static final Set<String> SORTABLE = Set.of("at", "action", "actorName");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "at");

    private final MongoTemplate mongoTemplate;

    public AuditLogQueryService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public PageResponse<AuditLogDto> search(String actor, ResourceType entityType, String action,
                                            Instant from, Instant to, Pageable requested) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("'from' must not be after 'to'");
        }
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        Criteria criteria = new Criteria();
        if (actor != null && !actor.isBlank()) {
            criteria.and("actorName").regex(Pattern.quote(actor.trim()), "i");
        }
        if (entityType != null) {
            criteria.and("entityType").is(entityType);
        }
        if (action != null && !action.isBlank()) {
            criteria.and("action").is(action.trim());
        }
        if (from != null || to != null) {
            Criteria at = criteria.and("at");
            if (from != null) {
                at.gte(from);
            }
            if (to != null) {
                at.lte(to);
            }
        }
        long total = mongoTemplate.count(Query.query(criteria), AuditLog.class);
        List<AuditLogDto> content = mongoTemplate.find(Query.query(criteria).with(pageable), AuditLog.class)
                .stream().map(AuditLogDto::from).toList();
        return PageResponse.of(content, pageable.getPageNumber(), pageable.getPageSize(), total);
    }
}
