package com.powerpulse.common;

import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/** Clamps client-supplied paging and restricts sorting to an allow-list of fields. */
public final class Pageables {

    public static final int MAX_SIZE = 200;

    private Pageables() {
    }

    public static Pageable sanitize(Pageable requested, Set<String> sortableFields, Sort defaultSort) {
        int size = Math.min(Math.max(requested.getPageSize(), 1), MAX_SIZE);
        int page = Math.max(requested.getPageNumber(), 0);
        Sort sort = Sort.by(requested.getSort().stream()
                .filter(order -> sortableFields.contains(order.getProperty()))
                .toList());
        return PageRequest.of(page, size, sort.isSorted() ? sort : defaultSort);
    }
}
