package com.powerpulse.common;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Lease lock in the {@code scheduler_locks} collection so that a scheduled job never runs
 * concurrently with itself (e.g. two application instances, or overlapping executions).
 */
@Service
public class SchedulerLockService {

    private final MongoTemplate mongoTemplate;
    private final String instanceId = ManagementFactory.getRuntimeMXBean().getName();

    public SchedulerLockService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Runs {@code task} only if the named lease could be acquired. Returns whether it ran. */
    public boolean tryRun(String jobName, Duration lease, Runnable task) {
        if (!acquire(jobName, lease)) {
            return false;
        }
        try {
            task.run();
            return true;
        } finally {
            release(jobName);
        }
    }

    boolean acquire(String jobName, Duration lease) {
        Instant now = Instant.now();
        Query query = Query.query(Criteria.where("_id").is(jobName).and("lockedUntil").lte(now));
        Update update = new Update().set("lockedUntil", now.plus(lease)).set("lockedBy", instanceId);
        try {
            SchedulerLock lock = mongoTemplate.findAndModify(query, update,
                    FindAndModifyOptions.options().upsert(true).returnNew(true), SchedulerLock.class);
            return lock != null;
        } catch (DuplicateKeyException held) {
            // Upsert collided with an existing, unexpired lock document.
            return false;
        }
    }

    void release(String jobName) {
        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(jobName).and("lockedBy").is(instanceId)),
                new Update().set("lockedUntil", Instant.EPOCH), SchedulerLock.class);
    }
}
