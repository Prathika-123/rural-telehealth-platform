package com.ruralhealth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;

import java.math.BigDecimal;
import java.time.Instant;

/** Join entity between Pharmacy and Medicine (many-to-many with its own data). */
@Entity
@Table(name = "pharmacy_inventory",
        uniqueConstraints = @UniqueConstraint(name = "uk_inventory_pharmacy_medicine",
                columnNames = {"pharmacy_id", "medicine_id"}),
        indexes = @Index(name = "idx_inventory_medicine_available", columnList = "medicine_id,available"))
@Check(constraints = "quantity >= 0")
@Getter @Setter @NoArgsConstructor
public class PharmacyInventory extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pharmacy_id", nullable = false)
    private Pharmacy pharmacy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "medicine_id", nullable = false)
    private Medicine medicine;

    @Min(0)
    @Column(nullable = false)
    private int quantity;

    @DecimalMin("0.00")
    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    /** Pharmacy can mark a medicine unavailable regardless of quantity. */
    @Column(nullable = false)
    private boolean available = true;

    /** When the pharmacy last touched this row. Used to show "updated X ago" and the STALE flag. */
    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        this.lastUpdatedAt = Instant.now();
    }
}
