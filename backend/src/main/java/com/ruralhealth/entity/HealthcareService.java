package com.ruralhealth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A service a centre can offer (e.g. "Maternal care", "Vaccination"). */
@Entity
@Table(name = "healthcare_services",
        uniqueConstraints = @UniqueConstraint(name = "uk_services_name", columnNames = "name"))
@Getter @Setter @NoArgsConstructor
public class HealthcareService extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 300)
    private String description;
}
