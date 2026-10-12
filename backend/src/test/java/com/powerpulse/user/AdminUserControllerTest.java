package com.powerpulse.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.security.AuthCookies;
import com.powerpulse.security.JwtService;
import com.powerpulse.security.SecurityConfig;
import com.powerpulse.security.SecurityTestSupport;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@WebMvcTest(controllers = {AdminUserController.class, UserLookupController.class})
@Import({SecurityConfig.class, JwtService.class, AuthCookies.class, UserAdminService.class, UserLookupService.class})
@ActiveProfiles("test")
class AdminUserControllerTest extends SecurityTestSupport {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private MongoTemplate mongoTemplate;

    private MockHttpServletRequestBuilder mutate(MockHttpServletRequestBuilder builder, Cookie auth) {
        return builder.cookie(auth, csrfCookie()).header("X-XSRF-TOKEN", CSRF_VALUE)
                .contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void listUsersIsForbiddenForEngineer() throws Exception {
        Cookie engineer = loginCookie(user("eng", Role.ENGINEER, true));

        mvc.perform(get("/api/v1/admin/users").cookie(engineer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void listUsersIsUnauthorizedWithoutCookie() throws Exception {
        mvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void listUsersReturnsPageForAdmin() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        User listed = user("op", Role.OPERATOR, true);
        listed.setPasswordHash("$2a$10$secret");
        when(mongoTemplate.find(any(Query.class), eq(User.class))).thenReturn(List.of(listed));

        mvc.perform(get("/api/v1/admin/users").param("q", "op").param("role", "OPERATOR")
                        .param("size", "1000").param("sort", "passwordHash,asc").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("op"))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.size").value(200))
                .andExpect(jsonPath("$.totalElements").value(1));

        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(query.capture(), eq(User.class));
        assertThat(query.getValue().getSortObject().toJson()).contains("name").doesNotContain("passwordHash");
        assertThat(query.getValue().getQueryObject().toJson()).contains("OPERATOR");
    }

    @Test
    void createUserRejectsWeakPasswordWithFieldErrors() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));

        mvc.perform(mutate(post("/api/v1/admin/users"), admin)
                        .content("{\"name\":\"New Person\",\"email\":\"new@powerpulse.local\","
                                + "\"password\":\"onlyletters\",\"role\":\"OPERATOR\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("password")));

        mvc.perform(mutate(post("/api/v1/admin/users"), admin)
                        .content("{\"name\":\"N\",\"email\":\"bad\",\"password\":\"short1\",\"role\":null}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("name")))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("email")))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("password")))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("role")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void createUserLowercasesEmailHashesPasswordAndAudits() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("new-id");
            return u;
        });

        mvc.perform(mutate(post("/api/v1/admin/users"), admin)
                        .content("{\"name\":\" New Person \",\"email\":\"New@PowerPulse.Local\","
                                + "\"password\":\"GoodPassword1\",\"role\":\"TECHNICIAN\",\"region\":\"North Ridge\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("new-id"))
                .andExpect(jsonPath("$.email").value("new@powerpulse.local"))
                .andExpect(jsonPath("$.name").value("New Person"))
                .andExpect(jsonPath("$.region").value("North Ridge"));

        verify(userRepository).save(argThat(u -> u.getPasswordHash().startsWith("$2")
                && !u.getPasswordHash().contains("GoodPassword1")));
        verify(auditService).record(eq("USER_CREATED"), eq(ResourceType.USER), eq("new-id"),
                argThat(s -> !s.contains("GoodPassword1")));
    }

    @Test
    void createUserWithDuplicateEmailIs409() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        when(userRepository.existsByEmailIgnoreCase("dup@powerpulse.local")).thenReturn(true);

        mvc.perform(mutate(post("/api/v1/admin/users"), admin)
                        .content("{\"name\":\"Dup\",\"email\":\"DUP@powerpulse.local\","
                                + "\"password\":\"GoodPassword1\",\"role\":\"OPERATOR\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void demotingTheLastActiveAdminIs409() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        User other = user("adm2", Role.ADMIN, true);
        when(userRepository.findById("adm2")).thenReturn(Optional.of(other));
        when(userRepository.countByRoleAndActiveTrue(Role.ADMIN)).thenReturn(1L);

        mvc.perform(mutate(patch("/api/v1/admin/users/adm2"), admin).content("{\"role\":\"ENGINEER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("At least one active administrator is required"));
        mvc.perform(mutate(patch("/api/v1/admin/users/adm2"), admin).content("{\"active\":false}"))
                .andExpect(status().isConflict());
        verify(userRepository, never()).save(any());
    }

    @Test
    void adminCannotDemoteOrDeactivateThemselves() throws Exception {
        User self = user("adm", Role.ADMIN, true);
        Cookie admin = loginCookie(self);
        when(userRepository.countByRoleAndActiveTrue(Role.ADMIN)).thenReturn(3L);

        mvc.perform(mutate(patch("/api/v1/admin/users/adm"), admin).content("{\"active\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You cannot deactivate or demote your own account"));
        mvc.perform(mutate(patch("/api/v1/admin/users/adm"), admin).content("{\"role\":\"OPERATOR\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void updateAppliesChangesAndRegionSemantics() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        User target = user("tech", Role.TECHNICIAN, true);
        target.setRegion("North Ridge");
        target.setPasswordHash("old-hash");
        when(userRepository.findById("tech")).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        // Absent region: unchanged.
        mvc.perform(mutate(patch("/api/v1/admin/users/tech"), admin).content("{\"name\":\"Renamed Tech\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed Tech"))
                .andExpect(jsonPath("$.region").value("North Ridge"));

        // Explicit null region: cleared. Password reset is hashed and never echoed.
        mvc.perform(mutate(patch("/api/v1/admin/users/tech"), admin)
                        .content("{\"region\":null,\"password\":\"NewPassword9\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.region").value(org.hamcrest.Matchers.nullValue()));
        assertThat(target.getRegion()).isNull();
        assertThat(target.getPasswordHash()).startsWith("$2").isNotEqualTo("old-hash");

        verify(auditService, org.mockito.Mockito.atLeastOnce()).record(eq("USER_UPDATED"), eq(ResourceType.USER),
                eq("tech"), argThat(s -> !s.contains("NewPassword9")));
    }

    @Test
    void updatePasswordValidationIs400() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));

        mvc.perform(mutate(patch("/api/v1/admin/users/tech"), admin).content("{\"password\":\"1234567890\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("password"));
    }

    @Test
    void malformedUpdateBodyIs400() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));

        mvc.perform(mutate(patch("/api/v1/admin/users/x"), admin).content("{\"role\":\"SUPERUSER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        mvc.perform(mutate(patch("/api/v1/admin/users/x"), admin).content("{\"passwordHash\":\"abc\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(mutate(patch("/api/v1/admin/users/x"), admin).content("{\"active\":\"yes\"}"))
                .andExpect(status().isBadRequest());
        verify(userRepository, never()).save(any());
    }

    @Test
    void updateUnknownUserIs404() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));
        when(userRepository.findById("missing")).thenReturn(Optional.empty());

        mvc.perform(mutate(patch("/api/v1/admin/users/missing"), admin).content("{\"name\":\"Whoever\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void assignableUsersRespectRolesAndSortByName() throws Exception {
        User zed = user("t1", Role.TECHNICIAN, true);
        zed.setName("zed");
        User amy = user("t2", Role.TECHNICIAN, true);
        amy.setName("Amy");
        when(userRepository.findByRoleInAndActiveTrue(List.of(Role.TECHNICIAN))).thenReturn(List.of(zed, amy));

        mvc.perform(get("/api/v1/users/assignable").param("role", "TECHNICIAN")
                        .cookie(loginCookie(user("tech", Role.TECHNICIAN, true))))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/users/assignable").param("role", "TECHNICIAN")
                        .cookie(loginCookie(user("op", Role.OPERATOR, true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Amy"))
                .andExpect(jsonPath("$[1].name").value("zed"))
                .andExpect(jsonPath("$[0].email").doesNotExist());
    }

    @Test
    void mutationWithoutCsrfIsForbidden() throws Exception {
        Cookie admin = loginCookie(user("adm", Role.ADMIN, true));

        mvc.perform(post("/api/v1/admin/users").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verify(userRepository, never()).existsByEmailIgnoreCase(anyString());
    }
}
