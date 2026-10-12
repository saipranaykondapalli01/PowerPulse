package com.powerpulse.transformer;

import com.powerpulse.common.domain.FaultType;
import com.powerpulse.common.domain.Severity;
import com.powerpulse.reading.ReadingSnapshotDto;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/** Transformer API records; each mirrors the same-named type in frontend/src/types/api.ts. */
public final class TransformerDtos {

    private TransformerDtos() {
    }

    /** Validation group for constraints that apply only on create (required fields). */
    public interface OnCreate {
    }

    public record TransformerDto(
            String id,
            String code,
            String name,
            String location,
            double latitude,
            double longitude,
            double gridX,
            double gridZ,
            List<String> connectedTo,
            double ratedCapacityKva,
            double primaryVoltageKv,
            double secondaryVoltageV,
            int healthScore,
            TransformerStatus status,
            ReadingSnapshotDto latestReading,
            Instant lastReadingAt,
            Long readingAgeSeconds,
            boolean stale,
            Instant lastMaintenanceAt,
            int activeFaultCount,
            Severity highestActiveSeverity,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record HealthFactorDto(String factor, double penalty, double maxPenalty, String detail) {
    }

    /** A suggested inspection action derived from rules. It is not a diagnosis. */
    public record Recommendation(FaultType faultType, String title, String action) {
    }

    /** {@code TransformerDetailDto extends TransformerDto} flattened (records cannot extend). */
    public record TransformerDetailDto(
            String id,
            String code,
            String name,
            String location,
            double latitude,
            double longitude,
            double gridX,
            double gridZ,
            List<String> connectedTo,
            double ratedCapacityKva,
            double primaryVoltageKv,
            double secondaryVoltageV,
            int healthScore,
            TransformerStatus status,
            ReadingSnapshotDto latestReading,
            Instant lastReadingAt,
            Long readingAgeSeconds,
            boolean stale,
            Instant lastMaintenanceAt,
            int activeFaultCount,
            Severity highestActiveSeverity,
            Instant createdAt,
            Instant updatedAt,
            List<HealthFactorDto> healthFactors,
            List<Recommendation> recommendations,
            double ratedCurrentA,
            int sensorTimeoutSeconds) {
    }

    /** Create (all required except coordinates/topology) or partial update (null fields ignored). */
    public record TransformerUpsertRequest(
            @NotBlank(groups = OnCreate.class)
            @Pattern(regexp = "^[A-Z0-9-]{3,20}$", message = "must be 3-20 characters: A-Z, 0-9 or '-'")
            String code,
            @NotBlank(groups = OnCreate.class)
            @Pattern(regexp = "(?s).*\\S.*", message = "must not be blank")
            @Size(max = 120)
            String name,
            @NotBlank(groups = OnCreate.class)
            @Pattern(regexp = "(?s).*\\S.*", message = "must not be blank")
            @Size(max = 80)
            String location,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            Double gridX,
            Double gridZ,
            @Size(max = 50) List<String> connectedTo,
            @NotNull(groups = OnCreate.class) @Positive Double ratedCapacityKva,
            @NotNull(groups = OnCreate.class) @Positive Double primaryVoltageKv,
            @NotNull(groups = OnCreate.class) @Positive Double secondaryVoltageV) {
    }

    /** {@code NetworkPreviewNode}: sanitized public view of the simulated network. */
    public record NetworkPreviewNode(
            String id,
            String code,
            String name,
            String location,
            double gridX,
            double gridZ,
            List<String> connectedTo,
            TransformerStatus status,
            int healthScore,
            Double loadPct,
            Double temperatureC,
            Double oilLevelPct,
            Double voltageV,
            Double currentA,
            double ratedCapacityKva,
            int activeFaultCount,
            boolean simulated) {
    }
}
