package com.powerpulse.alert;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.dao.DuplicateKeyException;

/** A Mockito-backed {@link AlertRepository} that stores alerts in memory and enforces the active-key uniqueness. */
final class InMemoryAlertRepository {

    final Map<String, Alert> store = new LinkedHashMap<>();
    final AlertRepository repo = mock(AlertRepository.class);
    private final AtomicInteger ids = new AtomicInteger();

    InMemoryAlertRepository() {
        lenient().when(repo.insert(any(Alert.class))).thenAnswer(inv -> {
            Alert a = inv.getArgument(0);
            boolean duplicate = a.isActive() && store.values().stream()
                    .anyMatch(x -> x.isActive() && x.getIncidentKey().equals(a.getIncidentKey()));
            if (duplicate) {
                throw new DuplicateKeyException("E11000 duplicate key: " + a.getIncidentKey());
            }
            a.setId("alert-" + ids.incrementAndGet());
            a.setCreatedAt(Instant.now());
            store.put(a.getId(), a);
            return a;
        });
        lenient().when(repo.save(any(Alert.class))).thenAnswer(inv -> {
            Alert a = inv.getArgument(0);
            store.put(a.getId(), a);
            return a;
        });
        lenient().when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get(
                (String) inv.getArgument(0))));
        lenient().when(repo.findByTransformerIdAndActiveTrue(anyString())).thenAnswer(inv -> active().stream()
                .filter(a -> a.getTransformerId().equals(inv.getArgument(0))).toList());
        lenient().when(repo.findByIncidentKeyAndActiveTrue(anyString())).thenAnswer(inv -> active().stream()
                .filter(a -> a.getIncidentKey().equals(inv.getArgument(0))).findFirst());
        lenient().when(repo.countByIncidentKeyAndActiveFalse(anyString())).thenAnswer(inv -> store.values().stream()
                .filter(a -> !a.isActive() && a.getIncidentKey().equals(inv.getArgument(0))).count());
    }

    List<Alert> active() {
        return new ArrayList<>(store.values().stream().filter(Alert::isActive).toList());
    }

    List<Alert> all() {
        return new ArrayList<>(store.values());
    }
}
