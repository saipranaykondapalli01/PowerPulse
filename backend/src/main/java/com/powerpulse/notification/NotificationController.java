package com.powerpulse.notification;

import com.powerpulse.common.PageResponse;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Notifications of the current user only (ownership enforced in {@link NotificationInboxService}). */
@RestController
@RequestMapping("/api/v1/notifications")
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationInboxService inbox;

    public NotificationController(NotificationInboxService inbox) {
        this.inbox = inbox;
    }

    @GetMapping
    public PageResponse<NotificationDto> list(@RequestParam(required = false) Boolean read,
                                              @RequestParam(required = false) NotificationType type,
                                              Pageable pageable) {
        return inbox.list(read, type, pageable);
    }

    @GetMapping("/unread-count")
    public UnreadCount unreadCount() {
        return inbox.unreadCount();
    }

    @PatchMapping("/{id}/read")
    public NotificationDto markRead(@PathVariable String id) {
        return inbox.markRead(id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead() {
        inbox.markAllRead();
    }
}
