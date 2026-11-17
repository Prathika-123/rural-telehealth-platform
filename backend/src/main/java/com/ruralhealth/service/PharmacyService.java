package com.ruralhealth.service;

import com.ruralhealth.dto.request.PharmacyRequest;
import com.ruralhealth.dto.response.*;
import com.ruralhealth.entity.Pharmacy;
import com.ruralhealth.entity.PharmacyInventory;
import com.ruralhealth.entity.VerificationStatus;
import com.ruralhealth.exception.DuplicateResourceException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.PharmacyInventoryRepository;
import com.ruralhealth.repository.PharmacyRepository;
import com.ruralhealth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PharmacyService {

    private static final Logger log = LoggerFactory.getLogger(PharmacyService.class);

    private final PharmacyRepository pharmacies;
    private final PharmacyInventoryRepository inventory;
    private final UserRepository users;
    private final StockPolicy stockPolicy;

    public PharmacyService(PharmacyRepository pharmacies, PharmacyInventoryRepository inventory,
                           UserRepository users, StockPolicy stockPolicy) {
        this.pharmacies = pharmacies;
        this.inventory = inventory;
        this.users = users;
        this.stockPolicy = stockPolicy;
    }

    // ---------- pharmacy owner ----------

    @Transactional
    public PharmacyResponse register(Long ownerId, PharmacyRequest req) {
        if (pharmacies.findByOwnerId(ownerId).isPresent()) {
            throw new DuplicateResourceException("PHARMACY_ALREADY_REGISTERED", "You have already registered a pharmacy.");
        }
        if (pharmacies.existsByLicenseNumber(req.licenseNumber().trim())) {
            throw new DuplicateResourceException("LICENSE_ALREADY_REGISTERED", "This licence number is already registered.");
        }
        Pharmacy p = new Pharmacy();
        p.setOwner(users.getReferenceById(ownerId));
        apply(p, req);
        p.setVerificationStatus(VerificationStatus.PENDING);
        pharmacies.save(p);
        log.info("Pharmacy registered: id={} (pending verification)", p.getId());
        return PharmacyResponse.forOwner(p);
    }

    @Transactional(readOnly = true)
    public PharmacyResponse getMine(Long ownerId) {
        return PharmacyResponse.forOwner(requireOwned(ownerId));
    }

    /** Changing the licence number or the location sends the pharmacy back to PENDING for re-verification. */
    @Transactional
    public PharmacyResponse updateMine(Long ownerId, PharmacyRequest req) {
        Pharmacy p = requireOwned(ownerId);
        String newLicense = req.licenseNumber().trim();
        boolean licenseChanged = !newLicense.equals(p.getLicenseNumber());
        if (licenseChanged && pharmacies.existsByLicenseNumber(newLicense)) {
            throw new DuplicateResourceException("LICENSE_ALREADY_REGISTERED", "This licence number is already registered.");
        }
        boolean moved = req.latitude().compareTo(p.getLatitude()) != 0
                || req.longitude().compareTo(p.getLongitude()) != 0;
        apply(p, req);
        if (licenseChanged || moved) {
            p.setVerificationStatus(VerificationStatus.PENDING);
            log.info("Pharmacy {} changed licence/location; re-verification required", p.getId());
        }
        return PharmacyResponse.forOwner(p);
    }

    // ---------- public ----------

    @Transactional(readOnly = true)
    public PharmacyResponse getPublic(Long id) {
        return PharmacyResponse.forPublic(requireVerified(id));
    }

    @Transactional(readOnly = true)
    public PageResponse<PharmacyStockItemResponse> listStock(Long pharmacyId, int page, int size) {
        requireVerified(pharmacyId);
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("id"));
        return PageResponse.from(inventory.findInStock(pharmacyId, pr), this::toStockItem);
    }

    // ---------- admin ----------

    @Transactional(readOnly = true)
    public PageResponse<PharmacyResponse> adminList(VerificationStatus status, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("id").descending());
        var result = status == null ? pharmacies.findAll(pr) : pharmacies.findByVerificationStatus(status, pr);
        return PageResponse.from(result, PharmacyResponse::forAdmin);
    }

    @Transactional
    public PharmacyResponse setVerification(Long id, VerificationStatus status, Long adminId) {
        Pharmacy p = pharmacies.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PHARMACY_NOT_FOUND", "Pharmacy not found."));
        p.setVerificationStatus(status);
        log.info("Admin {} set pharmacy {} to {}", adminId, id, status);
        return PharmacyResponse.forAdmin(p);
    }

    // ---------- helpers ----------

    private Pharmacy requireOwned(Long ownerId) {
        return pharmacies.findByOwnerId(ownerId).orElseThrow(() -> new ResourceNotFoundException(
                "PHARMACY_NOT_REGISTERED", "Register your pharmacy first."));
    }

    private Pharmacy requireVerified(Long id) {
        return pharmacies.findById(id)
                .filter(p -> p.getVerificationStatus() == VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ResourceNotFoundException("PHARMACY_NOT_FOUND", "Pharmacy not found."));
    }

    private PharmacyStockItemResponse toStockItem(PharmacyInventory i) {
        return new PharmacyStockItemResponse(MedicineResponse.from(i.getMedicine()), i.getPrice(),
                stockPolicy.status(i.getQuantity(), i.isAvailable()), i.getLastUpdatedAt(),
                stockPolicy.isStale(i.getLastUpdatedAt()));
    }

    private void apply(Pharmacy p, PharmacyRequest req) {
        p.setName(req.name().trim());
        p.setLicenseNumber(req.licenseNumber().trim());
        p.setAddress(req.address().trim());
        p.setTaluk(req.taluk());
        p.setDistrict(req.district());
        p.setPhone(req.phone());
        p.setLatitude(req.latitude());
        p.setLongitude(req.longitude());
    }
}
