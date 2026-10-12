package com.powerpulse.settings;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {

    private final SettingsServiceImpl settingsService;

    public SettingsController(SettingsServiceImpl settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public SystemSettingsDto get() {
        return settingsService.get();
    }

    @PatchMapping
    @PreAuthorize("hasRole('ADMIN')")
    public SystemSettingsDto update(@RequestBody SystemSettingsDto patch) {
        return settingsService.update(patch);
    }
}
