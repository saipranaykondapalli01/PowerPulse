package com.powerpulse.security;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.user.Role;
import com.powerpulse.user.User;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import testsupport.TestReadingsController;

@WebMvcTest(controllers = TestReadingsController.class)
@Import({SecurityConfig.class, JwtService.class, AuthCookies.class, TestReadingsController.class})
@ActiveProfiles("test")
class DeviceChainTest extends SecurityTestSupport {

    private static final String GOOD_KEY = "good-device-key-123";

    @Autowired
    private MockMvc mvc;

    private Device device() {
        Device device = new Device();
        device.setId("dev-1");
        device.setName("Gateway A");
        device.setKeyHash(DeviceKeys.sha256Hex(GOOD_KEY));
        return device;
    }

    @Test
    void missingKeyIs401Json() throws Exception {
        mvc.perform(post("/api/v1/readings").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Missing or invalid device key"));
        verify(deviceRepository, never()).findByKeyHashAndActiveTrue(anyString());
    }

    @Test
    void unknownKeyIs401() throws Exception {
        when(deviceRepository.findByKeyHashAndActiveTrue(anyString())).thenReturn(Optional.empty());

        mvc.perform(post("/api/v1/readings").header("X-Device-Key", "wrong-key")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void validKeyReachesControllerWithoutCsrf() throws Exception {
        when(deviceRepository.findByKeyHashAndActiveTrue(DeviceKeys.sha256Hex(GOOD_KEY)))
                .thenReturn(Optional.of(device()));

        mvc.perform(post("/api/v1/readings").header("X-Device-Key", GOOD_KEY)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").value("dev-1"))
                .andExpect(jsonPath("$.deviceName").value("Gateway A"));
    }

    @Test
    void userCookieDoesNotAuthenticateDeviceEndpoint() throws Exception {
        User admin = user("admin-1", Role.ADMIN, true);

        mvc.perform(post("/api/v1/readings").cookie(loginCookie(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sha256HexMatchesKnownVector() {
        org.assertj.core.api.Assertions.assertThat(DeviceKeys.sha256Hex("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
