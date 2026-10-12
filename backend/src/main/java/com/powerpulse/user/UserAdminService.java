package com.powerpulse.user;

import com.powerpulse.audit.AuditService;
import com.powerpulse.common.ConflictException;
import com.powerpulse.common.CurrentUser;
import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.ResourceType;
import com.powerpulse.security.AuthenticatedUser;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** User administration (ADMIN only): search, create, update, with self-lockout and last-admin protection. */
@Service
public class UserAdminService {

    static final Set<String> SORTABLE = Set.of("name", "email", "role", "region", "active", "createdAt", "updatedAt");
    static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "name");
    private static final int MAX_QUERY_LENGTH = 100;

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserAdminService(UserRepository userRepository, MongoTemplate mongoTemplate,
                            PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    public PageResponse<UserDto> search(String q, Role role, Pageable requested) {
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        List<Criteria> criteria = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            String term = q.trim();
            if (term.length() > MAX_QUERY_LENGTH) {
                term = term.substring(0, MAX_QUERY_LENGTH);
            }
            String regex = Pattern.quote(term);
            criteria.add(new Criteria().orOperator(
                    Criteria.where("name").regex(regex, "i"),
                    Criteria.where("email").regex(regex, "i")));
        }
        if (role != null) {
            criteria.add(Criteria.where("role").is(role.name()));
        }
        Query query = new Query();
        if (!criteria.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteria.toArray(Criteria[]::new)));
        }
        Query countQuery = Query.of(query);
        query.with(pageable);
        List<User> users = mongoTemplate.find(query, User.class);
        Page<User> page = PageableExecutionUtils.getPage(users, pageable,
                () -> mongoTemplate.count(countQuery, User.class));
        return PageResponse.of(page, UserMapper::toDto);
    }

    public UserDto create(UserCreateRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("A user with this email already exists");
        }
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setRegion(normalizeRegion(request.region()));
        user.setActive(true);
        User saved = userRepository.save(user);
        auditService.record("USER_CREATED", ResourceType.USER, saved.getId(),
                "Created user " + saved.getEmail() + " with role " + saved.getRole());
        return UserMapper.toDto(saved);
    }

    public UserDto update(String id, UserUpdateRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User", id));
        AuthenticatedUser actor = CurrentUser.require();

        Role newRole = request.role() != null ? request.role() : user.getRole();
        boolean newActive = request.active() != null ? request.active() : user.isActive();
        boolean losesAdmin = user.getRole() == Role.ADMIN && user.isActive()
                && (newRole != Role.ADMIN || !newActive);
        if (losesAdmin) {
            if (actor.id().equals(user.getId())) {
                throw new ConflictException("You cannot deactivate or demote your own account");
            }
            if (userRepository.countByRoleAndActiveTrue(Role.ADMIN) <= 1) {
                throw new ConflictException("At least one active administrator is required");
            }
        }

        List<String> changes = new ArrayList<>();
        if (request.name() != null && !request.name().trim().equals(user.getName())) {
            user.setName(request.name().trim());
            changes.add("name");
        }
        if (newRole != user.getRole()) {
            changes.add("role " + user.getRole() + " -> " + newRole);
            user.setRole(newRole);
        }
        if (request.region() != null) {
            String newRegion = normalizeRegion(request.region().orElse(null));
            if (!Objects.equals(newRegion, user.getRegion())) {
                user.setRegion(newRegion);
                changes.add("region");
            }
        }
        if (newActive != user.isActive()) {
            changes.add(newActive ? "activated" : "deactivated");
            user.setActive(newActive);
        }
        if (request.password() != null) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            changes.add("password reset");
        }
        if (changes.isEmpty()) {
            return UserMapper.toDto(user);
        }
        User saved = userRepository.save(user);
        auditService.record("USER_UPDATED", ResourceType.USER, saved.getId(),
                "Updated user " + saved.getEmail() + ": " + String.join(", ", changes));
        return UserMapper.toDto(saved);
    }

    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeRegion(String region) {
        return Optional.ofNullable(region).map(String::trim).filter(r -> !r.isEmpty()).orElse(null);
    }
}
