package com.powerpulse.transformer;

import com.powerpulse.transformer.TransformerDtos.NetworkPreviewNode;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Unauthenticated, sanitized view of the simulated network for the landing page. */
@RestController
@RequestMapping("/api/v1/public")
public class PublicController {

    private final TransformerService transformerService;

    public PublicController(TransformerService transformerService) {
        this.transformerService = transformerService;
    }

    @GetMapping("/network-preview")
    public List<NetworkPreviewNode> networkPreview() {
        return transformerService.networkPreview();
    }
}
