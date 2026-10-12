package com.powerpulse.notification;

import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * The current user's notification inbox. Every operation is scoped to {@link CurrentUser#require()}; another
 * user's notification is reported as "not found" so that its existence is never revealed.
 */
@Service
public class NotificationInboxService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt");

    private final NotificationRepository repository;
    private final MongoTemplate mongoTemplate;

    public NotificationInboxService(NotificationRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    public PageResponse<NotificationDto> list(Boolean read, NotificationType type, Pageable requested) {
        String userId = CurrentUser.require().id();
        Pageable pageable = Pageables.sanitize(requested, Set.of("createdAt"), NEWEST_FIRST);
        Criteria criteria = Criteria.where("recipientId").is(userId);
        if (read != null) {
            criteria.and("read").is(read);
        }
        if (type != null) {
            criteria.and("type").is(type);
        }
        long total = mongoTemplate.count(Query.query(criteria), Notification.class);
        List<NotificationDto> content = mongoTemplate.find(Query.query(criteria).with(pageable), Notification.class)
                .stream().map(NotificationDto::from).toList();
        return PageResponse.of(content, pageable.getPageNumber(), pageable.getPageSize(), total);
    }

    public UnreadCount unreadCount() {
        return new UnreadCount(repository.countByRecipientIdAndReadFalse(CurrentUser.require().id()));
    }

    public NotificationDto markRead(String id) {
        String userId = CurrentUser.require().id();
        Notification n = repository.findByIdAndRecipientId(id, userId)
                .orElseThrow(() -> new NotFoundException("Notification", id));
        if (!n.isRead()) {
            Instant now = Instant.now();
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(n.getId()).and("recipientId").is(userId)),
                    new Update().set("read", true).set("readAt", now), Notification.class);
            n.setRead(true);
            n.setReadAt(now);
        }
        return NotificationDto.from(n);
    }

    public void markAllRead() {
        String userId = CurrentUser.require().id();
        mongoTemplate.updateMulti(Query.query(Criteria.where("recipientId").is(userId).and("read").is(false)),
                new Update().set("read", true).set("readAt", Instant.now()), Notification.class);
    }
}
