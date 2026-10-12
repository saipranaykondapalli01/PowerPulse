package com.powerpulse.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates sensor gateways by the {@code X-Device-Key} header (SHA-256 hashed and matched against active
 * devices). Unknown or missing keys leave the request anonymous, so the device chain answers 401.
 * Not a Spring bean on purpose: it is only registered inside the device filter chain.
 */
public class DeviceKeyAuthenticationFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Device-Key";
    public static final String ROLE_DEVICE = "ROLE_DEVICE";

    private final DeviceRepository deviceRepository;

    public DeviceKeyAuthenticationFilter(DeviceRepository deviceRepository) {
        this.deviceRepository = deviceRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getHeader(HEADER);
        if (key != null && !key.isBlank()) {
            deviceRepository.findByKeyHashAndActiveTrue(DeviceKeys.sha256Hex(key.trim())).ifPresent(device -> {
                var auth = new UsernamePasswordAuthenticationToken(
                        new DevicePrincipal(device.getId(), device.getName()), null,
                        List.of(new SimpleGrantedAuthority(ROLE_DEVICE)));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(auth);
                SecurityContextHolder.setContext(context);
            });
        }
        chain.doFilter(request, response);
    }
}
