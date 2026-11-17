package com.ruralhealth.repository;

import com.ruralhealth.entity.HealthcareService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HealthcareServiceRepository extends JpaRepository<HealthcareService, Long> {
    Optional<HealthcareService> findByNameIgnoreCase(String name);
}
