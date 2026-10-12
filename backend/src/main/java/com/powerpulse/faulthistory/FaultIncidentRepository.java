package com.powerpulse.faulthistory;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FaultIncidentRepository extends MongoRepository<FaultIncident, String> {

    Optional<FaultIncident> findByAlertId(String alertId);

    List<FaultIncident> findByTransformerIdOrderByStartedAtDesc(String transformerId);

    long countByTransformerIdAndResolvedAtAfter(String transformerId, Instant since);
}
