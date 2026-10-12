package com.powerpulse.fault;

import com.powerpulse.alert.AlertService;
import com.powerpulse.common.SchedulerLockService;
import com.powerpulse.notification.NotificationService;
import com.powerpulse.settings.SettingsService;
import com.powerpulse.settings.SystemSettings;
import com.powerpulse.transformer.Transformer;
import com.powerpulse.transformer.TransformerStateService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Opens STALE_READING alerts for transformers that stopped reporting (no reading within
 * {@code sensorTimeoutSeconds}), which sets their status OFFLINE, and sends TRANSFORMER_OFFLINE once per episode.
 */
@Component
public class StaleReadingJob {

    private static final Logger log = LoggerFactory.getLogger(StaleReadingJob.class);
    static final String JOB_NAME = "stale-reading-check";
    static final Duration LEASE = Duration.ofMinutes(2);

    private final SchedulerLockService lockService;
    private final MongoTemplate mongoTemplate;
    private final FaultDetectionService faultDetectionService;
    private final AlertService alertService;
    private final TransformerStateService stateService;
    private final NotificationService notificationService;
    private final SettingsService settingsService;
    private final Clock clock;

    @Autowired
    public StaleReadingJob(SchedulerLockService lockService, MongoTemplate mongoTemplate,
                           FaultDetectionService faultDetectionService, AlertService alertService,
                           TransformerStateService stateService, NotificationService notificationService,
                           SettingsService settingsService) {
        this(lockService, mongoTemplate, faultDetectionService, alertService, stateService, notificationService,
                settingsService, Clock.systemUTC());
    }

    public StaleReadingJob(SchedulerLockService lockService, MongoTemplate mongoTemplate,
                           FaultDetectionService faultDetectionService, AlertService alertService,
                           TransformerStateService stateService, NotificationService notificationService,
                           SettingsService settingsService, Clock clock) {
        this.lockService = lockService;
        this.mongoTemplate = mongoTemplate;
        this.faultDetectionService = faultDetectionService;
        this.alertService = alertService;
        this.stateService = stateService;
        this.notificationService = notificationService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${powerpulse.jobs.stale-check-ms:30000}",
            initialDelayString = "${powerpulse.jobs.stale-check-ms:30000}")
    public void run() {
        lockService.tryRun(JOB_NAME, LEASE, this::checkAll);
    }

    /** Evaluates every transformer that has not reported within the timeout. Returns the number of stale ones. */
    public int checkAll() {
        SystemSettings settings = settingsService.current();
        Instant now = Instant.now(clock);
        Instant cutoff = now.minusSeconds(settings.getSensorTimeoutSeconds());
        Query q = Query.query(new Criteria().orOperator(
                Criteria.where("lastReadingAt").lt(cutoff),
                new Criteria().andOperator(Criteria.where("lastReadingAt").is(null),
                        Criteria.where("createdAt").lt(cutoff))));
        List<Transformer> candidates = mongoTemplate.find(q, Transformer.class);
        int stale = 0;
        for (Transformer t : candidates) {
            try {
                Optional<FaultFinding> finding = faultDetectionService.evaluateStale(t, settings, now);
                if (finding.isEmpty()) {
                    continue;
                }
                stale++;
                AlertService.AlertOutcome outcome = alertService.reconcileStale(t, finding.get());
                stateService.refresh(t.getId());
                if (outcome.created()) {
                    notificationService.notifyTransformerOffline(t, outcome.alert());
                }
            } catch (RuntimeException e) {
                log.warn("Stale check failed for transformer {}: {}", t.getCode(), e.toString(), e);
            }
        }
        return stale;
    }
}
