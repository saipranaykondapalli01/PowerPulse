package com.powerpulse;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// Users authenticate via the JWT cookie filter; no in-memory default user is needed.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class PowerPulseApplication {

    public static void main(String[] args) {
        SpringApplication.run(PowerPulseApplication.class, args);
    }
}
