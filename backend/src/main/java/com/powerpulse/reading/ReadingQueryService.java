package com.powerpulse.reading;

import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.domain.ReadingSource;
import com.powerpulse.reading.ReadingDtos.ReadingDto;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Reading history for charts, downsampled by time-bucket averaging when a range holds too many points. */
@Service
public class ReadingQueryService {

    public static final int DEFAULT_MAX_POINTS = 500;
    public static final int MAX_POINTS_CAP = 2000;
    static final Duration DEFAULT_RANGE = Duration.ofHours(24);

    private final MongoTemplate mongoTemplate;

    public ReadingQueryService(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    /** Ascending readings in [from, to]; defaults to the last 24 h and 500 points (capped at 2000). */
    public List<ReadingDto> history(String transformerId, Instant from, Instant to, Integer maxPoints, Instant now) {
        Instant end = to != null ? to : now;
        Instant start = from != null ? from : end.minus(DEFAULT_RANGE);
        if (start.isAfter(end)) {
            throw new BadRequestException("from must not be after to");
        }
        int limit = maxPoints == null ? DEFAULT_MAX_POINTS : Math.max(1, Math.min(maxPoints, MAX_POINTS_CAP));
        Criteria criteria = Criteria.where("transformerId").is(transformerId).and("recordedAt").gte(start).lte(end);
        long count = mongoTemplate.count(Query.query(criteria), SensorReading.class);
        if (count <= limit) {
            Query q = Query.query(criteria).with(Sort.by(Sort.Order.asc("recordedAt")));
            return mongoTemplate.find(q, SensorReading.class).stream().map(ReadingDto::from).toList();
        }
        return downsample(transformerId, start, end, limit);
    }

    /**
     * Groups readings into {@code limit} equal time buckets starting at {@code start} and averages each metric.
     * Bucket rows carry the bucket start as {@code recordedAt} and a synthetic id {@code bucket-<epochMillis>}.
     */
    List<ReadingDto> downsample(String transformerId, Instant start, Instant end, int limit) {
        long rangeMs = Math.max(1, Duration.between(start, end).toMillis());
        // floor(range / limit) + 1 guarantees every index (including a reading exactly at `end`) is < limit.
        long bucketMs = rangeMs / limit + 1;
        Date startDate = Date.from(start);
        List<Document> pipeline = List.of(
                new Document("$match", new Document("transformerId", transformerId)
                        .append("recordedAt", new Document("$gte", startDate).append("$lte", Date.from(end)))),
                new Document("$sort", new Document("recordedAt", 1)),
                new Document("$group", new Document("_id",
                        new Document("$floor", new Document("$divide", List.of(
                                new Document("$subtract", List.of("$recordedAt", startDate)), bucketMs))))
                        .append("temperatureC", new Document("$avg", "$temperatureC"))
                        .append("oilLevelPct", new Document("$avg", "$oilLevelPct"))
                        .append("voltageV", new Document("$avg", "$voltageV"))
                        .append("currentA", new Document("$avg", "$currentA"))
                        .append("loadPct", new Document("$avg", "$loadPct"))
                        .append("powerFactor", new Document("$avg", "$powerFactor"))
                        .append("source", new Document("$last", "$source"))
                        .append("simulationId", new Document("$last", "$simulationId"))
                        .append("scenario", new Document("$last", "$scenario"))),
                new Document("$sort", new Document("_id", 1)));
        List<ReadingDto> out = new ArrayList<>();
        for (Document d : mongoTemplate.getCollection(mongoTemplate.getCollectionName(SensorReading.class))
                .aggregate(pipeline)) {
            long index = ((Number) d.get("_id")).longValue();
            Instant bucketStart = start.plusMillis(index * bucketMs);
            String source = d.getString("source");
            out.add(new ReadingDto("bucket-" + bucketStart.toEpochMilli(), transformerId,
                    round(d.get("temperatureC")), round(d.get("oilLevelPct")), round(d.get("voltageV")),
                    round(d.get("currentA")), round(d.get("loadPct")), round(d.get("powerFactor")),
                    source == null ? null : ReadingSource.valueOf(source), d.getString("simulationId"),
                    d.getString("scenario"), bucketStart));
        }
        return out;
    }

    private static Double round(Object v) {
        if (!(v instanceof Number n)) {
            return null;
        }
        return Math.round(n.doubleValue() * 1000.0) / 1000.0;
    }
}
