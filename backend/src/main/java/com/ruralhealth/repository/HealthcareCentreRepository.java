package com.ruralhealth.repository;

import com.ruralhealth.entity.CentreType;
import com.ruralhealth.entity.HealthcareCentre;
import com.ruralhealth.entity.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface HealthcareCentreRepository extends JpaRepository<HealthcareCentre, Long> {

    List<HealthcareCentre> findByManagerId(Long managerId);

    Page<HealthcareCentre> findByVerificationStatus(VerificationStatus status, Pageable pageable);

    @Query("""
            select c from HealthcareCentre c
            where c.verificationStatus = :status
              and c.latitude between :minLat and :maxLat
              and c.longitude between :minLng and :maxLng""")
    List<HealthcareCentre> findInBox(@Param("status") VerificationStatus status,
                                     @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
                                     @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
                                     Pageable limit);

    @Query("""
            select c from HealthcareCentre c
            where c.verificationStatus = :status and c.type = :type
              and c.latitude between :minLat and :maxLat
              and c.longitude between :minLng and :maxLng""")
    List<HealthcareCentre> findInBoxByType(@Param("status") VerificationStatus status,
                                           @Param("type") CentreType type,
                                           @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
                                           @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
                                           Pageable limit);
    long countByVerificationStatus(VerificationStatus status);
}
