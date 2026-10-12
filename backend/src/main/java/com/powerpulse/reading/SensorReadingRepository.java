package com.powerpulse.reading;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SensorReadingRepository extends MongoRepository<SensorReading, String> {

    Optional<SensorReading> findFirstByTransformerIdOrderByRecordedAtDesc(String transformerId);

    List<SensorReading> findByTransformerIdAndRecordedAtBetweenOrderByRecordedAtAsc(String transformerId,
                                                                                    Instant from, Instant to);
}
