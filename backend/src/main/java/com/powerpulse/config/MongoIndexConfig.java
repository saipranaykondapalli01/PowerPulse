package com.powerpulse.config;

import com.powerpulse.reading.SensorReading;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

/**
 * Creates indexes whose options come from configuration (annotation-driven indexes cannot read
 * property placeholders). Raw sensor readings expire after {@code powerpulse.retention.reading-days}.
 */
@Component
public class MongoIndexConfig {

    private static final Logger log = LoggerFactory.getLogger(MongoIndexConfig.class);

    private final MongoTemplate mongoTemplate;
    private final int readingRetentionDays;

    public MongoIndexConfig(MongoTemplate mongoTemplate,
                            @Value("${powerpulse.retention.reading-days:90}") int readingRetentionDays) {
        this.mongoTemplate = mongoTemplate;
        this.readingRetentionDays = readingRetentionDays;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        try {
            mongoTemplate.indexOps(SensorReading.class).ensureIndex(
                    new Index().on("recordedAt", Sort.Direction.ASC)
                            .named("recorded_ttl")
                            .expire(Duration.ofDays(readingRetentionDays)));
        } catch (RuntimeException e) {
            // An existing TTL index with a different expiry cannot be redefined in place.
            log.warn("Could not ensure reading TTL index ({} days): {}", readingRetentionDays, e.getMessage());
        }
    }
}
