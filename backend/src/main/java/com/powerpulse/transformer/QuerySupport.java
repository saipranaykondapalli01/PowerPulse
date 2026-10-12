package com.powerpulse.transformer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

/** Shared helpers for filtered, paged list queries (transformers, alerts). */
public final class QuerySupport {

    private QuerySupport() {
    }

    /** Case-insensitive "contains" pattern with all regex metacharacters of the user input escaped. */
    public static Pattern containsIgnoreCase(String q) {
        return Pattern.compile(escapeRegex(q.trim()), Pattern.CASE_INSENSITIVE);
    }

    /** Backslash-escapes every regex metacharacter so user input is matched literally. */
    public static String escapeRegex(String s) {
        StringBuilder sb = new StringBuilder(s.length() * 2);
        for (char c : s.toCharArray()) {
            if ("\\^$.|?*+()[]{}-/".indexOf(c) >= 0) {
                sb.append('\\');
            }
            sb.append(c);
        }
        return sb.toString();
    }

    public static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * Runs a paged query. Enum fields listed in {@code enumRanks} are sorted by their logical order (index in the
     * given list) rather than alphabetically, using an {@code $addFields}/{@code $indexOfArray} aggregation stage.
     * Criteria values must be plain BSON-compatible values (use {@code Enum.name()} for enums).
     */
    public static <T> Page<T> page(MongoTemplate mongoTemplate, Criteria criteria, Pageable pageable,
                                   Class<T> type, String collection, Map<String, List<String>> enumRanks) {
        List<AggregationOperation> ops = new ArrayList<>();
        ops.add(Aggregation.match(criteria));
        Document addFields = new Document();
        List<Sort.Order> orders = new ArrayList<>();
        for (Sort.Order o : pageable.getSort()) {
            List<String> ranks = enumRanks.get(o.getProperty());
            if (ranks != null) {
                String rankField = "_rank_" + o.getProperty().replace('.', '_');
                addFields.put(rankField, new Document("$indexOfArray", List.of(ranks, "$" + o.getProperty())));
                orders.add(new Sort.Order(o.getDirection(), rankField));
            } else {
                orders.add(o);
            }
        }
        orders.add(Sort.Order.asc("_id"));
        if (!addFields.isEmpty()) {
            ops.add(context -> new Document("$addFields", addFields));
        }
        ops.add(Aggregation.sort(Sort.by(orders)));
        ops.add(Aggregation.skip(pageable.getOffset()));
        ops.add(Aggregation.limit(pageable.getPageSize()));
        List<T> content = mongoTemplate.aggregate(Aggregation.newAggregation(ops), collection, type)
                .getMappedResults();
        long total = mongoTemplate.count(Query.query(criteria), type);
        return new PageImpl<>(content, pageable, total);
    }

    public static List<String> names(Enum<?>[] values) {
        List<String> out = new ArrayList<>();
        for (Enum<?> v : values) {
            out.add(v.name());
        }
        return out;
    }
}
