package com.powerpulse.simulation;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface SimulationStateRepository extends MongoRepository<SimulationState, String> {
}
