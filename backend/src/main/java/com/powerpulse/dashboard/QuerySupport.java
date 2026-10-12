package com.powerpulse.dashboard;

import com.powerpulse.common.BadRequestException;
import com.powerpulse.common.PageResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.bson.Document;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

/** Query helpers shared by the workflow modules (paging with enum-rank sorting, raw aggregation stages). */
public final class QuerySupport {

    private QuerySupport() {
    }

    /** A raw aggregation stage (values must already be BSON-encodable: strings, numbers, dates). */
    public static AggregationOperation stage(String operator, Object body) {
        return context -> new Document(operator, body);
    }

    /**
     * Pages {@code criteria} over {@code type}. Fields in {@code rankedFields} hold enum names whose natural order
     * (e.g. LOW &lt; MEDIUM &lt; HIGH &lt; CRITICAL) differs from alphabetical order; when such a field is part of
     * the sort, the query runs as an aggregation that sorts on the enum's ordinal.
     */
    public static <T, R> PageResponse<R> page(MongoTemplate mongoTemplate, Criteria criteria, Pageable pageable,
                                              Class<T> type, Map<String, List<String>> rankedFields,
                                              Function<T, R> mapper) {
        long total = mongoTemplate.count(Query.query(criteria), type);
        boolean ranked = pageable.getSort().stream().anyMatch(o -> rankedFields.containsKey(o.getProperty()));
        List<T> rows;
        if (!ranked) {
            rows = mongoTemplate.find(Query.query(criteria).with(pageable), type);
        } else {
            Document addFields = new Document();
            Document sort = new Document();
            for (Sort.Order order : pageable.getSort()) {
                int dir = order.isAscending() ? 1 : -1;
                List<String> ranks = rankedFields.get(order.getProperty());
                if (ranks != null) {
                    String rankField = "__rank_" + order.getProperty();
                    addFields.append(rankField, new Document("$indexOfArray", List.of(ranks, "$" + order.getProperty())));
                    sort.append(rankField, dir);
                } else {
                    sort.append(order.getProperty(), dir);
                }
            }
            sort.append("_id", 1);
            List<AggregationOperation> ops = new ArrayList<>();
            ops.add(Aggregation.match(criteria));
            ops.add(stage("$addFields", addFields));
            ops.add(stage("$sort", sort));
            ops.add(stage("$skip", (long) pageable.getPageNumber() * pageable.getPageSize()));
            ops.add(stage("$limit", pageable.getPageSize()));
            rows = mongoTemplate.aggregate(Aggregation.newAggregation(type, ops), type).getMappedResults();
        }
        return PageResponse.of(rows.stream().map(mapper).toList(), pageable.getPageNumber(), pageable.getPageSize(),
                total);
    }

    public static <E extends Enum<E>> List<String> names(Class<E> enumType) {
        List<String> names = new ArrayList<>();
        for (E e : enumType.getEnumConstants()) {
            names.add(e.name());
        }
        return names;
    }

    /** Validates an optional time window. */
    public static void requireOrdered(Instant from, Instant to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("'from' must not be after 'to'");
        }
    }

    public static Instant toInstant(Object value) {
        if (value instanceof Date d) {
            return d.toInstant();
        }
        if (value instanceof Instant i) {
            return i;
        }
        return null;
    }

    public static long toLong(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    public static Double toDouble(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    public static Double round(Double value, int decimals) {
        if (value == null || value.isNaN() || value.isInfinite()) {
            return null;
        }
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }
}
