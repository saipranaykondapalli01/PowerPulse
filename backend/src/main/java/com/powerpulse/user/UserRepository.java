package com.powerpulse.user;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByRoleInAndActiveTrue(Collection<Role> roles);

    List<User> findByActiveTrueOrderByNameAsc();

    long countByRoleAndActiveTrue(Role role);
}
