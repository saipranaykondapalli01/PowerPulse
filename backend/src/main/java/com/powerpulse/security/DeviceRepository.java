package com.powerpulse.security;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DeviceRepository extends MongoRepository<Device, String> {

    Optional<Device> findByKeyHashAndActiveTrue(String keyHash);

    boolean existsByKeyHash(String keyHash);
}
