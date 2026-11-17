package com.ruralhealth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "pharmacies",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_pharmacies_owner", columnNames = "owner_user_id"),
                @UniqueConstraint(name = "uk_pharmacies_license", columnNames = "license_number")},
        indexes = {
                @Index(name = "idx_pharmacies_lat_lng", columnList = "latitude,longitude"),
                @Index(name = "idx_pharmacies_status", columnList = "verification_status")})
@Getter @Setter @NoArgsConstructor
public class Pharmacy extends BaseEntity {

    /** One user (role PHARMACY) owns at most one pharmacy. */
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "license_number", nullable = false, length = 60)
    private String licenseNumber;

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

    /** Only VERIFIED pharmacies appear in public search results. */
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.PENDING;
}
