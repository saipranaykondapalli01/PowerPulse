package com.powerpulse.maintenance;

import java.util.Collection;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MaintenanceTaskRepository extends MongoRepository<MaintenanceTask, String> {

    List<MaintenanceTask> findByTransformerIdOrderByCreatedAtDesc(String transformerId);

    List<MaintenanceTask> findByTransformerIdAndAssignedTechnicianIdOrderByCreatedAtDesc(String transformerId,
                                                                                       String technicianId);

    long countByStatusIn(Collection<MaintenanceStatus> statuses);
}
