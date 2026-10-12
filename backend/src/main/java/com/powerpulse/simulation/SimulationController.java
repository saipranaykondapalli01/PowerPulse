package com.powerpulse.simulation;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/simulation")
public class SimulationController {

    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @GetMapping("/status")
    public SimulationStatusDto status() {
        return simulationService.status();
    }

    @PostMapping("/start")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public SimulationStatusDto start() {
        return simulationService.start();
    }

    @PostMapping("/pause")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public SimulationStatusDto pause() {
        return simulationService.pause();
    }

    @PostMapping("/reset")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public SimulationStatusDto reset() {
        return simulationService.reset();
    }

    @PostMapping("/scenarios/{scenarioName}")
    @PreAuthorize("hasAnyRole('ADMIN','ENGINEER')")
    public SimulationStatusDto applyScenario(@PathVariable String scenarioName,
                                             @RequestParam(required = false) String transformerId) {
        return simulationService.applyScenario(scenarioName, transformerId);
    }
}
