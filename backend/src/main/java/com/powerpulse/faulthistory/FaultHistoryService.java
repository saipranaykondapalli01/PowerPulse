package com.powerpulse.faulthistory;

import com.powerpulse.common.NotFoundException;
import com.powerpulse.common.PageResponse;
import com.powerpulse.common.Pageables;
import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.dashboard.QuerySupport;
import com.powerpulse.transformer.TransformerRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

/** Read side of the fault history. */
@Service
public class FaultHistoryService {

    private static final Set<String> SORTABLE = Set.of("startedAt", "durationSeconds", "severity");
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "startedAt");
    private static final Map<String, List<String>> RANKED = Map.of("severity", QuerySupport.names(Severity.class));

    private final MongoTemplate mongoTemplate;
    private final FaultIncidentRepository repository;
    private final TransformerRepository transformerRepository;

    public FaultHistoryService(MongoTemplate mongoTemplate, FaultIncidentRepository repository,
                               TransformerRepository transformerRepository) {
        this.mongoTemplate = mongoTemplate;
        this.repository = repository;
        this.transformerRepository = transformerRepository;
    }

    public PageResponse<FaultIncidentDto> search(String transformerId, String location, FaultType faultType,
                                                 Severity severity, Instant from, Instant to, Pageable requested) {
        QuerySupport.requireOrdered(from, to);
        Pageable pageable = Pageables.sanitize(requested, SORTABLE, DEFAULT_SORT);
        Criteria criteria = new Criteria();
        if (transformerId != null && !transformerId.isBlank()) {
            criteria.and("transformerId").is(transformerId);
        }
        if (location != null && !location.isBlank()) {
            criteria.and("location").is(location);
        }
        if (faultType != null) {
            criteria.and("faultType").is(faultType);
        }
        if (severity != null) {
            criteria.and("severity").is(severity);
        }
        if (from != null || to != null) {
            Criteria started = criteria.and("startedAt");
            if (from != null) {
                started.gte(from);
            }
            if (to != null) {
                started.lte(to);
            }
        }
        return QuerySupport.page(mongoTemplate, criteria, pageable, FaultIncident.class, RANKED,
                FaultIncidentDto::from);
    }

    public List<FaultIncidentDto> forTransformer(String transformerId) {
        if (!transformerRepository.existsById(transformerId)) {
            throw new NotFoundException("Transformer", transformerId);
        }
        return repository.findByTransformerIdOrderByStartedAtDesc(transformerId).stream()
                .map(FaultIncidentDto::from).toList();
    }
}
