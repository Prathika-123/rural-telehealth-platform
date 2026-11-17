package com.ruralhealth.repository;

import com.ruralhealth.entity.PharmacyInventory;
import com.ruralhealth.entity.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PharmacyInventoryRepository extends JpaRepository<PharmacyInventory, Long> {

    /** Scoped lookup: a pharmacy can only ever load its own rows. */
    Optional<PharmacyInventory> findByIdAndPharmacyId(Long id, Long pharmacyId);

    boolean existsByPharmacyIdAndMedicineId(Long pharmacyId, Long medicineId);

    boolean existsByMedicineId(Long medicineId);

    @Query(value = "select i from PharmacyInventory i join fetch i.medicine where i.pharmacy.id = :pid",
            countQuery = "select count(i) from PharmacyInventory i where i.pharmacy.id = :pid")
    Page<PharmacyInventory> findOwnInventory(@Param("pid") Long pharmacyId, Pageable pageable);

    @Query(value = """
            select i from PharmacyInventory i join fetch i.medicine
            where i.pharmacy.id = :pid and i.available = true and i.quantity > 0""",
            countQuery = """
            select count(i) from PharmacyInventory i
            where i.pharmacy.id = :pid and i.available = true and i.quantity > 0""")
    Page<PharmacyInventory> findInStock(@Param("pid") Long pharmacyId, Pageable pageable);

    /**
     * Core of medicine search. Only rows that are marked available, have stock, and belong to a verified
     * pharmacy inside the bounding box. The exact radius check and sorting happen afterwards (Haversine).
     */
    @Query("""
            select i from PharmacyInventory i
            join fetch i.pharmacy p
            join fetch i.medicine m
            where i.available = true and i.quantity > 0
              and p.verificationStatus = :status
              and p.latitude between :minLat and :maxLat
              and p.longitude between :minLng and :maxLng
              and (lower(m.genericName) like :pattern escape '!' or lower(m.brandName) like :pattern escape '!')""")
    List<PharmacyInventory> searchAvailable(@Param("pattern") String pattern,
                                            @Param("status") VerificationStatus status,
                                            @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
                                            @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
                                            Pageable limit);

    @Query("""
            select i from PharmacyInventory i
            join fetch i.pharmacy p
            join fetch i.medicine m
            where i.available = true and i.quantity > 0
              and p.verificationStatus = :status
              and p.latitude between :minLat and :maxLat
              and p.longitude between :minLng and :maxLng
              and (lower(m.genericName) like :pattern escape '!' or lower(m.brandName) like :pattern escape '!')
              and replace(lower(m.strength), ' ', '') = :strength""")
    List<PharmacyInventory> searchAvailableWithStrength(@Param("pattern") String pattern,
                                                        @Param("strength") String strength,
                                                        @Param("status") VerificationStatus status,
                                                        @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
                                                        @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
                                                        Pageable limit);

    long countByLastUpdatedAtBefore(java.time.Instant cutoff);

    /** Newest inventory changes first, for the admin activity monitor. */
    @Query(value = "select i from PharmacyInventory i join fetch i.pharmacy join fetch i.medicine order by i.lastUpdatedAt desc",
            countQuery = "select count(i) from PharmacyInventory i")
    Page<PharmacyInventory> findRecentActivity(Pageable pageable);
}
