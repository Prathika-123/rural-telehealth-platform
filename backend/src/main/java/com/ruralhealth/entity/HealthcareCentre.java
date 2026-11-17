package com.ruralhealth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

/** Hospitals, PHCs, CHCs and clinics share one table, distinguished by {@link CentreType}. */
@Entity
@Table(name = "healthcare_centres",
        indexes = {
                @Index(name = "idx_centres_lat_lng", columnList = "latitude,longitude"),
                @Index(name = "idx_centres_type", columnList = "type")})
@Getter @Setter @NoArgsConstructor
public class HealthcareCentre extends BaseEntity {

    /** The HEALTHCARE_PROVIDER user who manages this centre. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_user_id")
    private User manager;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CentreType type;

    @Column(nullable = false, length = 300)
    private String address;

    @Column(length = 100)
    private String taluk;

    @Column(length = 100)
    private String district;

    @Column(length = 15)
    private String phone;

    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "emergency_available", nullable = false)
    private boolean emergencyAvailable = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;

    @ManyToMany
    @BatchSize(size = 50)
    @JoinTable(name = "healthcare_centre_services",
            joinColumns = @JoinColumn(name = "centre_id"),
            inverseJoinColumns = @JoinColumn(name = "service_id"))
    private Set<HealthcareService> services = new HashSet<>();
}
