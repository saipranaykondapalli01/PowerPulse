package com.powerpulse.transformer;

import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TransformerRepository extends MongoRepository<Transformer, String> {

    Optional<Transformer> findByCode(String code);

    boolean existsByCode(String code);

    List<Transformer> findByLocation(String location);

    long countByStatus(TransformerStatus status);
}
