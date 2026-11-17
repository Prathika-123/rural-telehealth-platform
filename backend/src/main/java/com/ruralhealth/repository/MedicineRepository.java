package com.ruralhealth.repository;

import com.ruralhealth.entity.Medicine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MedicineRepository extends JpaRepository<Medicine, Long> {

    Page<Medicine> findByGenericNameContainingIgnoreCaseOrBrandNameContainingIgnoreCase(
            String generic, String brand, Pageable pageable);

    boolean existsByBrandNameIgnoreCaseAndGenericNameIgnoreCaseAndStrengthIgnoreCaseAndDosageFormIgnoreCase(
            String brand, String generic, String strength, String dosageForm);

    /** Counts catalogue matches; pattern is a LIKE pattern with '!' as escape character. */
    @Query("""
            select count(m) from Medicine m
            where lower(m.genericName) like :pattern escape '!' or lower(m.brandName) like :pattern escape '!'""")
    long countMatching(@Param("pattern") String pattern);

    @Query("""
            select count(m) from Medicine m
            where (lower(m.genericName) like :pattern escape '!' or lower(m.brandName) like :pattern escape '!')
              and replace(lower(m.strength), ' ', '') = :strength""")
    long countMatchingWithStrength(@Param("pattern") String pattern, @Param("strength") String strength);
}
