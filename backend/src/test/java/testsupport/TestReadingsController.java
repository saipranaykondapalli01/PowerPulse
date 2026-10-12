package testsupport;

import com.powerpulse.security.DevicePrincipal;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only stand-in for the real readings controller. Lives outside {@code com.powerpulse} so component
 * scanning never registers it; tests opt in with {@code @Import}.
 */
@RestController
public class TestReadingsController {

    @PostMapping("/api/v1/readings")
    public Map<String, String> ingest(@AuthenticationPrincipal DevicePrincipal device) {
        return Map.of("deviceId", device.id(), "deviceName", device.name());
    }
}
