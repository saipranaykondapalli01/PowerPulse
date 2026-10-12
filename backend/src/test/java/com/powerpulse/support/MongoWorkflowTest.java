package com.powerpulse.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * {@code @DataMongoTest} against the local MongoDB (database {@code powerpulse_test_workflows}). Tests clear
 * documents with {@link Fixtures#clean} rather than dropping collections so that unique indexes survive.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@DataMongoTest(properties = {
        "spring.data.mongodb.database=powerpulse_test_workflows",
        "spring.data.mongodb.auto-index-creation=true"})
@ActiveProfiles("test")
public @interface MongoWorkflowTest {
}
