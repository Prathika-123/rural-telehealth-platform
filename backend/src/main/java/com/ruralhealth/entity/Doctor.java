package com.ruralhealth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "doctors",
        indexes = @Index(name = "idx_doctors_specialization", columnList = "specialization"))
@Getter @Setter @NoArgsConstructor
public class Doctor extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 100)
    private String specialization;

    @Column(length = 150)
    private String qualification;

    @Column(length = 15)
    private String phone;

    @Column(name = "experience_years")
    private Integer experienceYears;

    /** Home centre; also decides which provider is allowed to manage this doctor. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "primary_centre_id", nullable = false)
    private HealthcareCentre primaryCentre;

    /** Provider override, e.g. "on leave today". Ignored once it expires. */
    @Enumerated(EnumType.STRING)
    @Column(name = "manual_status", nullable = false, length = 20)
    private ManualStatus manualStatus = ManualStatus.NONE;

    @Column(name = "manual_status_expires_at")
    private Instant manualStatusExpiresAt;
}
