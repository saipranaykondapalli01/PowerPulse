package com.powerpulse.user;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

/** Read-only user lookups for assignee pickers. */
@Service
public class UserLookupService {

    private final UserRepository userRepository;

    public UserLookupService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Active users, optionally filtered by role, sorted by name (case-insensitive). */
    public List<UserSummary> assignable(Role role) {
        List<User> users = role == null
                ? userRepository.findByActiveTrueOrderByNameAsc()
                : userRepository.findByRoleInAndActiveTrue(List.of(role));
        return users.stream()
                .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(UserMapper::toSummary)
                .toList();
    }
}
