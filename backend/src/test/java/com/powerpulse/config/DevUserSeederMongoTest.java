package com.powerpulse.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.powerpulse.security.Device;
import com.powerpulse.security.DeviceKeys;
import com.powerpulse.security.DeviceRepository;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

/** Runs against the local MongoDB, database {@code powerpulse_test_security}. */
@DataMongoTest(properties = "spring.data.mongodb.database=powerpulse_test_security")
@ActiveProfiles("test")
class DevUserSeederMongoTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DeviceRepository deviceRepository;
    @Autowired
    private MongoTemplate mongoTemplate;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @BeforeEach
    @AfterEach
    void clean() {
        assertThat(mongoTemplate.getDb().getName()).isEqualTo("powerpulse_test_security");
        userRepository.deleteAll();
        deviceRepository.deleteAll();
    }

    @Test
    void seedsDocumentedAccountsAndDemoDeviceIdempotently() {
        DevUserSeeder seeder = new DevUserSeeder(userRepository, deviceRepository, encoder);
        seeder.seed();
        seeder.seed();

        assertThat(userRepository.count()).isEqualTo(6);
        assertThat(deviceRepository.count()).isEqualTo(1);

        User admin = userRepository.findByEmailIgnoreCase("admin@powerpulse.local").orElseThrow();
        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        assertThat(admin.isActive()).isTrue();
        assertThat(encoder.matches("PowerPulse!Admin1", admin.getPasswordHash())).isTrue();
        assertThat(userRepository.findByEmailIgnoreCase("tech@powerpulse.local").orElseThrow().getRegion())
                .isEqualTo("North Ridge");
        assertThat(userRepository.findByEmailIgnoreCase("tech2@powerpulse.local").orElseThrow().getRegion())
                .isEqualTo("Harbor District");
        assertThat(userRepository.findByEmailIgnoreCase("demo@powerpulse.local").orElseThrow().getRole())
                .isEqualTo(Role.ENGINEER);

        Device device = deviceRepository.findByKeyHashAndActiveTrue(DeviceKeys.sha256Hex("dev-device-key-change-me"))
                .orElseThrow();
        assertThat(device.getName()).isEqualTo("Demo gateway");
        assertThat(device.getKeyHash()).hasSize(64).doesNotContain("dev-device-key");
    }
}
