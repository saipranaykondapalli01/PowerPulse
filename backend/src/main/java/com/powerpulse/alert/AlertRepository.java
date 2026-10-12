package com.powerpulse.alert;

import com.powerpulse.common.domain.FaultType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AlertRepository extends MongoRepository<Alert, String> {

    Optional<Alert> findByIncidentKeyAndActiveTrue(String incidentKey);

    List<Alert> findByTransformerIdAndActiveTrue(String transformerId);

    List<Alert> findByTransformerIdOrderByCreatedAtDesc(String transformerId);

    long countByIncidentKeyAndActiveFalse(String incidentKey);

    long countByActiveTrue();

    long countByTransformerIdAndFaultTypeAndActiveFalse(String transformerId, FaultType faultType);
}
