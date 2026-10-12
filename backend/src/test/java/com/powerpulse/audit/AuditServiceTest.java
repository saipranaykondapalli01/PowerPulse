package com.powerpulse.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.powerpulse.common.PageResponse;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.support.Fixtures;
import com.powerpulse.support.MongoWorkflowTest;
import com.powerpulse.support.TestAuth;
import com.powerpulse.user.Role;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;

@MongoWorkflowTest
@Import({AuditServiceImpl.class, AuditLogQueryService.class})
class AuditServiceTest {

    @Autowired AuditServiceImpl auditService;
    @Autowired AuditLogQueryService queryService;
    @Autowired MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        Fixtures.clean(mongoTemplate);
    }

    @AfterEach
    void tearDown() {
        TestAuth.logout();
    }

    @Test
    void recordsActorFromCurrentUserOrSystem() throws InterruptedException {
        TestAuth.loginAs("u-1", "Ada Admin", Role.ADMIN);
        auditService.record("SETTINGS_UPDATED", ResourceType.SETTINGS, "global", "Changed thresholds");
        TestAuth.logout();
        Thread.sleep(5); // distinct timestamps for the newest-first assertion
        auditService.record("ALERT_RESOLVED", ResourceType.ALERT, "a-1", "Auto-resolved");

        PageResponse<AuditLogDto> page = queryService.search(null, null, null, null, null, PageRequest.of(0, 10));
        assertThat(page.totalElements()).isEqualTo(2);
        // newest first
        assertThat(page.content().get(0).actorName()).isEqualTo("system");
        assertThat(page.content().get(0).actorId()).isNull();
        assertThat(page.content().get(1).actorName()).isEqualTo("Ada Admin");
        assertThat(page.content().get(1).actorId()).isEqualTo("u-1");
        assertThat(page.content().get(1).at()).isNotNull();
    }

    @Test
    void neverThrowsIntoCallers() {
        AuditLogRepository failing = mock(AuditLogRepository.class);
        when(failing.save(any())).thenThrow(new DataAccessResourceFailureException("down"));
        assertThatCode(() -> new AuditServiceImpl(failing).record("X", ResourceType.USER, "1", "s"))
                .doesNotThrowAnyException();
    }

    @Test
    void searchFiltersWithEscapedActorRegex() {
        TestAuth.loginAs("u-1", "Ada (Admin)", Role.ADMIN);
        auditService.record("USER_CREATED", ResourceType.USER, "u-9", "Created user");
        TestAuth.loginAs("u-2", "Erin Engineer", Role.ENGINEER);
        auditService.record("MAINTENANCE_CREATED", ResourceType.MAINTENANCE, "m-1", "Created task");

        assertThat(queryService.search("ada (", null, null, null, null, PageRequest.of(0, 10)).totalElements())
                .isEqualTo(1);
        assertThat(queryService.search(".*", null, null, null, null, PageRequest.of(0, 10)).totalElements()).isZero();
        assertThat(queryService.search(null, ResourceType.MAINTENANCE, null, null, null, PageRequest.of(0, 10))
                .content()).singleElement().satisfies(l -> assertThat(l.actorName()).isEqualTo("Erin Engineer"));
        assertThat(queryService.search(null, null, "USER_CREATED", null, null, PageRequest.of(0, 10)).totalElements())
                .isEqualTo(1);
        assertThat(queryService.search(null, null, null, Instant.now().plus(Duration.ofMinutes(1)), null,
                PageRequest.of(0, 10)).totalElements()).isZero();
        assertThat(queryService.search(null, null, null, Instant.now().minus(Duration.ofMinutes(1)), Instant.now(),
                PageRequest.of(0, 10)).totalElements()).isEqualTo(2);
    }
}
