package com.powerpulse.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.security.AuthenticatedUser;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Runs against the local MongoDB, database {@code powerpulse_test_security} (never the default db). */
@DataMongoTest(properties = "spring.data.mongodb.database=powerpulse_test_security")
@Import({UserAdminService.class, UserAdminServiceMongoTest.Beans.class})
@ActiveProfiles("test")
class UserAdminServiceMongoTest {

    static class Beans {
        @Bean
        PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder(4);
        }
    }

    @Autowired
    private UserAdminService service;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private MongoTemplate mongoTemplate;
    @MockitoBean
    private AuditService auditService;

    private User admin;

    @BeforeEach
    void setUp() {
        assertThat(mongoTemplate.getDb().getName()).isEqualTo("powerpulse_test_security");
        userRepository.deleteAll();
        admin = save("Alice Admin", "alice@powerpulse.local", Role.ADMIN, true);
        save("Bob Engineer", "bob@powerpulse.local", Role.ENGINEER, true);
        save("Carol Operator", "carol.ops@powerpulse.local", Role.OPERATOR, true);
        save("Dan Tech", "dan@powerpulse.local", Role.TECHNICIAN, false);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(admin.getId(), admin.getName(), admin.getEmail(), Role.ADMIN, null), null,
                List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        userRepository.deleteAll();
    }

    private User save(String name, String email, Role role, boolean active) {
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setRole(role);
        user.setActive(active);
        user.setPasswordHash("x");
        return userRepository.save(user);
    }

    @Test
    void searchMatchesNameOrEmailCaseInsensitivelyAndFiltersByRole() {
        PageResponse<UserDto> byEmail = service.search("OPS", null, PageRequest.of(0, 20));
        assertThat(byEmail.content()).extracting(UserDto::name).containsExactly("Carol Operator");

        PageResponse<UserDto> byName = service.search("bob", null, PageRequest.of(0, 20));
        assertThat(byName.content()).extracting(UserDto::email).containsExactly("bob@powerpulse.local");

        PageResponse<UserDto> byRole = service.search(null, Role.TECHNICIAN, PageRequest.of(0, 20));
        assertThat(byRole.content()).extracting(UserDto::name).containsExactly("Dan Tech");

        // Regex metacharacters are treated literally.
        assertThat(service.search(".*", null, PageRequest.of(0, 20)).content()).isEmpty();
    }

    @Test
    void searchPagesAndSortsByNameByDefault() {
        PageResponse<UserDto> page = service.search(null, null, PageRequest.of(1, 3));
        assertThat(page.totalElements()).isEqualTo(4);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.content()).extracting(UserDto::name).containsExactly("Dan Tech");

        PageResponse<UserDto> desc = service.search(null, null, PageRequest.of(0, 2, Sort.by("email").descending()));
        assertThat(desc.content()).extracting(UserDto::email).containsExactly("dan@powerpulse.local",
                "carol.ops@powerpulse.local");
    }

    @Test
    void createRejectsDuplicateEmailIgnoringCase() {
        assertThatThrownBy(() -> service.create(new UserCreateRequest("Bob Two", "BOB@PowerPulse.local",
                "GoodPassword1", Role.ENGINEER, null))).isInstanceOf(ConflictException.class);
    }

    @Test
    void lastActiveAdminCannotBeDemotedButAnotherAdminCan() {
        User second = save("Zed Admin", "zed@powerpulse.local", Role.ADMIN, true);

        // Two active admins: the other one can be demoted.
        UserDto demoted = service.update(second.getId(),
                new UserUpdateRequest(null, Role.ENGINEER, null, null, null));
        assertThat(demoted.role()).isEqualTo(Role.ENGINEER);

        // Now Alice is the only active admin; reactivate scenario: make Zed admin again but inactive.
        service.update(second.getId(), new UserUpdateRequest(null, Role.ADMIN, Optional.empty(), false, null));
        assertThat(userRepository.countByRoleAndActiveTrue(Role.ADMIN)).isEqualTo(1);

        // Switch actor to Zed (pretend) so the self-check does not apply, then try to deactivate Alice.
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser(second.getId(), "Zed", "zed@powerpulse.local", Role.ADMIN, null), null,
                List.of()));
        assertThatThrownBy(() -> service.update(admin.getId(),
                new UserUpdateRequest(null, null, null, false, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("At least one active administrator");
        assertThat(userRepository.findById(admin.getId())).get().extracting(User::isActive).isEqualTo(true);
    }
}
