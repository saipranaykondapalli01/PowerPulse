package com.powerpulse.user;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserLookupController {

    private final UserLookupService userLookupService;

    public UserLookupController(UserLookupService userLookupService) {
        this.userLookupService = userLookupService;
    }

    @GetMapping("/assignable")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER','OPERATOR')")
    public List<UserSummary> assignable(@RequestParam(required = false) Role role) {
        return userLookupService.assignable(role);
    }
}
