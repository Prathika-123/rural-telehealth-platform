package com.ruralhealth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Catalogue entry. A medicine is stored once and linked to many pharmacies via PharmacyInventory. */
@Entity
@Table(name = "medicines",
        uniqueConstraints = @UniqueConstraint(name = "uk_medicines_identity",
                columnNames = {"generic_name", "strength", "dosage_form", "brand_name"}),
        indexes = {
                @Index(name = "idx_medicines_generic", columnList = "generic_name"),
                @Index(name = "idx_medicines_brand", columnList = "brand_name")})
@Getter @Setter @NoArgsConstructor
public class Medicine extends BaseEntity {

    @Column(name = "brand_name", nullable = false, length = 120)
    private String brandName;

    @Column(name = "generic_name", nullable = false, length = 120)
    private String genericName;

    /** e.g. "500mg". */
    @Column(nullable = false, length = 40)
    private String strength;

    /** e.g. "Tablet", "Syrup". */
    @Column(name = "dosage_form", nullable = false, length = 40)
    private String dosageForm;

    @Column(name = "prescription_required", nullable = false)
    private boolean prescriptionRequired = false;
}
