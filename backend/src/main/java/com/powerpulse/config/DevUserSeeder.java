package com.powerpulse.config;

import com.powerpulse.security.Device;
import com.powerpulse.security.DeviceKeys;
import com.powerpulse.security.DeviceRepository;
import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds the documented development accounts (docs/security.md) and one demo device. Dev profile only,
 * idempotent (existing emails / device key hashes are left untouched). Runs before other seeders so data
 * seeders can reference these users.
 */
@Component
@Profile("dev")
@ConditionalOnProperty(prefix = "powerpulse.seed", name = "enabled", havingValue = "true")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class DevUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevUserSeeder.class);

    /** Development-only device key, documented in docs/security.md. Only its SHA-256 hash is stored. */
    static final String DEMO_DEVICE_KEY = "dev-device-key-change-me";
    static final String DEMO_DEVICE_NAME = "Demo gateway";

    record SeedAccount(String name, String email, String password, Role role, String region) {

        @Override
        public String toString() {
            return "SeedAccount[email=" + email + ", role=" + role + "]";
        }
    }

    static final List<SeedAccount> ACCOUNTS = List.of(
            new SeedAccount("Avery Admin", "admin@powerpulse.local", "PowerPulse!Admin1", Role.ADMIN, null),
            new SeedAccount("Elena Engineer", "engineer@powerpulse.local", "PowerPulse!Eng1", Role.ENGINEER, null),
            new SeedAccount("Omar Operator", "operator@powerpulse.local", "PowerPulse!Op1", Role.OPERATOR, null),
            new SeedAccount("Tariq Technician", "tech@powerpulse.local", "PowerPulse!Tech1", Role.TECHNICIAN,
                    "North Ridge"),
            new SeedAccount("Tess Technician", "tech2@powerpulse.local", "PowerPulse!Tech2", Role.TECHNICIAN,
                    "Harbor District"),
            new SeedAccount("Demo Visitor", "demo@powerpulse.local", "PowerPulse!Demo1", Role.ENGINEER, null));

    private final UserRepository userRepository;
    private final DeviceRepository deviceRepository;
    private final PasswordEncoder passwordEncoder;

    public DevUserSeeder(UserRepository userRepository, DeviceRepository deviceRepository,
                         PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.deviceRepository = deviceRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed();
    }

    void seed() {
        int createdUsers = 0;
        for (SeedAccount account : ACCOUNTS) {
            if (userRepository.existsByEmailIgnoreCase(account.email())) {
                continue;
            }
            User user = new User();
            user.setName(account.name());
            user.setEmail(account.email());
            user.setPasswordHash(passwordEncoder.encode(account.password()));
            user.setRole(account.role());
            user.setRegion(account.region());
            user.setActive(true);
            userRepository.save(user);
            createdUsers++;
        }
        boolean createdDevice = false;
        String keyHash = DeviceKeys.sha256Hex(DEMO_DEVICE_KEY);
        if (!deviceRepository.existsByKeyHash(keyHash)) {
            Device device = new Device();
            device.setName(DEMO_DEVICE_NAME);
            device.setKeyHash(keyHash);
            device.setActive(true);
            deviceRepository.save(device);
            createdDevice = true;
        }
        log.info("Dev seed: {} user account(s) created, demo device {}", createdUsers,
                createdDevice ? "created" : "already present");
    }
}
