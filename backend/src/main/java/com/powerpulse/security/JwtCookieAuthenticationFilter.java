package com.powerpulse.security;

import com.powerpulse.user.User;
import com.powerpulse.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the {@code pp_token} cookie, verifies the JWT and loads the user, who must still exist and be active.
 * The authority comes from the stored role (not the token), so role changes and deactivation apply immediately.
 * An invalid, expired or orphaned token leaves the request anonymous and the cookie is cleared.
 * Not a Spring bean on purpose: it is only registered inside the main filter chain.
 */
public class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AuthCookies authCookies;

    public JwtCookieAuthenticationFilter(JwtService jwtService, UserRepository userRepository, AuthCookies authCookies) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.authCookies = authCookies;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = AuthCookies.readToken(request);
        if (token != null && !token.isEmpty()) {
            Optional<User> user = jwtService.parse(token)
                    .flatMap(claims -> userRepository.findById(claims.userId()))
                    .filter(User::isActive)
                    .filter(u -> u.getRole() != null);
            if (user.isPresent()) {
                authenticate(user.get());
            } else {
                response.addHeader(HttpHeaders.SET_COOKIE, authCookies.expiredTokenCookie().toString());
            }
        }
        chain.doFilter(request, response);
    }

    private static void authenticate(User user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getName(), user.getEmail(),
                user.getRole(), user.getRegion());
        var auth = new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
    }
}
