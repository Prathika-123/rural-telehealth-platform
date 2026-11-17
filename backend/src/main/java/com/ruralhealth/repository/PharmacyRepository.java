package com.ruralhealth.repository;

import com.ruralhealth.entity.Pharmacy;
import com.ruralhealth.entity.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PharmacyRepository extends JpaRepository<Pharmacy, Long> {
    Optional<Pharmacy> findByOwnerId(Long ownerId);
    boolean existsByLicenseNumber(String licenseNumber);
    Page<Pharmacy> findByVerificationStatus(VerificationStatus status, Pageable pageable);
    long countByVerificationStatus(VerificationStatus status);
}
