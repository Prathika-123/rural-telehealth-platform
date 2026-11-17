package com.ruralhealth.service;

import com.ruralhealth.dto.response.AdminStatsResponse;
import com.ruralhealth.dto.response.InventoryActivityResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.entity.PharmacyInventory;
import com.ruralhealth.entity.Role;
import com.ruralhealth.entity.VerificationStatus;
import com.ruralhealth.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AdminStatsService {

    private final UserRepository users;
    private final PharmacyRepository pharmacies;
    private final HealthcareCentreRepository centres;
    private final DoctorRepository doctors;
    private final MedicineRepository medicines;
    private final PharmacyInventoryRepository inventory;
    private final StockPolicy stockPolicy;

    public AdminStatsService(UserRepository users, PharmacyRepository pharmacies, HealthcareCentreRepository centres,
                             DoctorRepository doctors, MedicineRepository medicines,
                             PharmacyInventoryRepository inventory, StockPolicy stockPolicy) {
        this.users = users;
        this.pharmacies = pharmacies;
        this.centres = centres;
        this.doctors = doctors;
        this.medicines = medicines;
        this.inventory = inventory;
        this.stockPolicy = stockPolicy;
    }

    @Transactional(readOnly = true)
    public AdminStatsResponse stats() {
        Map<String, Long> byRole = new LinkedHashMap<>();
        for (Role r : Role.values()) byRole.put(r.name(), users.countByRole(r));
        Map<String, Long> pharmacyStatus = new LinkedHashMap<>();
        Map<String, Long> centreStatus = new LinkedHashMap<>();
        for (VerificationStatus s : VerificationStatus.values()) {
            pharmacyStatus.put(s.name(), pharmacies.countByVerificationStatus(s));
            centreStatus.put(s.name(), centres.countByVerificationStatus(s));
        }
        Instant cutoff = Instant.now().minus(Duration.ofDays(stockPolicy.staleAfterDays()));
        return new AdminStatsResponse(users.count(), byRole, pharmacyStatus, centreStatus, doctors.count(),
                medicines.count(), inventory.count(), inventory.countByLastUpdatedAtBefore(cutoff),
                stockPolicy.staleAfterDays());
    }

    @Transactional(readOnly = true)
    public PageResponse<InventoryActivityResponse> recentActivity(int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        return PageResponse.from(inventory.findRecentActivity(pr), this::toActivity);
    }

    private InventoryActivityResponse toActivity(PharmacyInventory i) {
        return new InventoryActivityResponse(i.getId(), i.getPharmacy().getId(), i.getPharmacy().getName(),
                i.getMedicine().getBrandName() + " (" + i.getMedicine().getGenericName() + " " + i.getMedicine().getStrength() + ")",
                i.getQuantity(), i.isAvailable(), i.getLastUpdatedAt(), stockPolicy.isStale(i.getLastUpdatedAt()));
    }
}
