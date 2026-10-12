package com.powerpulse.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class SecurityPropertiesBindingTest {

    @EnableConfigurationProperties({PowerPulseSecurityProperties.class, CorsProperties.class})
    static class Config {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner().withUserConfiguration(Config.class);

    @Test
    void startupFailsWhenSecretMissingOrShort() {
        runner.run(ctx -> assertThat(ctx).hasFailed());
        runner.withPropertyValues("powerpulse.security.jwt.secret=")
                .run(ctx -> assertThat(ctx).hasFailed());
        runner.withPropertyValues("powerpulse.security.jwt.secret=only-31-bytes-long-secret-value")
                .run(ctx -> assertThat(ctx).hasFailed());
    }

    @Test
    void bindsValidSecretWithDefaults() {
        runner.withPropertyValues("powerpulse.security.jwt.secret=exactly-32-bytes-long-secret-val",
                        "powerpulse.cors.allowed-origins=http://localhost:5173, https://app.example.com")
                .run(ctx -> {
                    assertThat(ctx).hasNotFailed();
                    PowerPulseSecurityProperties props = ctx.getBean(PowerPulseSecurityProperties.class);
                    assertThat(props.jwt().expiryMinutes()).isEqualTo(480);
                    assertThat(props.cookieSecure()).isTrue();
                    assertThat(props.jwt().toString()).doesNotContain("exactly-32");
                    assertThat(ctx.getBean(CorsProperties.class).allowedOrigins())
                            .containsExactly("http://localhost:5173", "https://app.example.com");
                });
    }
}
