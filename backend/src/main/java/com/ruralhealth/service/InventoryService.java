package com.ruralhealth.service;

import com.ruralhealth.dto.request.InventoryRequest;
import com.ruralhealth.dto.request.InventoryUpdateRequest;
import com.ruralhealth.dto.response.InventoryResponse;
import com.ruralhealth.dto.response.MedicineResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.entity.Medicine;
import com.ruralhealth.entity.Pharmacy;
import com.ruralhealth.entity.PharmacyInventory;
import com.ruralhealth.exception.DuplicateResourceException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.MedicineRepository;
import com.ruralhealth.repository.PharmacyInventoryRepository;
import com.ruralhealth.repository.PharmacyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Inventory management for the logged-in pharmacy. Every lookup is scoped to the caller's own pharmacy,
 * so one pharmacy can never read or change another's rows.
 */
@Service
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);

    private final PharmacyRepository pharmacies;
    private final MedicineRepository medicines;
    private final PharmacyInventoryRepository inventory;
    private final StockPolicy stockPolicy;

    public InventoryService(PharmacyRepository pharmacies, MedicineRepository medicines,
                            PharmacyInventoryRepository inventory, StockPolicy stockPolicy) {
        this.pharmacies = pharmacies;
        this.medicines = medicines;
        this.inventory = inventory;
        this.stockPolicy = stockPolicy;
    }

    @Transactional(readOnly = true)
    public PageResponse<InventoryResponse> list(Long ownerId, int page, int size) {
        Pharmacy p = requirePharmacy(ownerId);
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("id").descending());
        return PageResponse.from(inventory.findOwnInventory(p.getId(), pr), this::toResponse);
    }

    @Transactional
    public InventoryResponse add(Long ownerId, InventoryRequest req) {
        Pharmacy p = requirePharmacy(ownerId);
        Medicine m = medicines.findById(req.medicineId()).orElseThrow(() ->
                new ResourceNotFoundException("MEDICINE_NOT_FOUND", "Medicine not found in the catalogue."));
        if (inventory.existsByPharmacyIdAndMedicineId(p.getId(), m.getId())) {
            throw new DuplicateResourceException("INVENTORY_ALREADY_EXISTS",
                    "This medicine is already in your inventory. Edit the existing entry instead.");
        }
        PharmacyInventory i = new PharmacyInventory();
        i.setPharmacy(p);
        i.setMedicine(m);
        i.setQuantity(req.quantity());
        i.setPrice(req.price());
        i.setAvailable(req.available() == null || req.available());
        i.setLastUpdatedAt(Instant.now());
        inventory.save(i);
        log.info("Inventory added: pharmacy={} medicine={}", p.getId(), m.getId());
        return toResponse(i);
    }

    /** Every update (even with unchanged numbers) refreshes lastUpdatedAt: it means "I checked my stock". */
    @Transactional
    public InventoryResponse update(Long ownerId, Long inventoryId, InventoryUpdateRequest req) {
        PharmacyInventory i = findOwn(ownerId, inventoryId);
        i.setQuantity(req.quantity());
        i.setPrice(req.price());
        if (req.available() != null) {
            i.setAvailable(req.available());
        }
        i.setLastUpdatedAt(Instant.now());
        return toResponse(i);
    }

    @Transactional
    public InventoryResponse markUnavailable(Long ownerId, Long inventoryId) {
        PharmacyInventory i = findOwn(ownerId, inventoryId);
        i.setAvailable(false);
        i.setLastUpdatedAt(Instant.now());
        return toResponse(i);
    }

    @Transactional
    public void delete(Long ownerId, Long inventoryId) {
        inventory.delete(findOwn(ownerId, inventoryId));
    }

    private PharmacyInventory findOwn(Long ownerId, Long inventoryId) {
        Pharmacy p = requirePharmacy(ownerId);
        return inventory.findByIdAndPharmacyId(inventoryId, p.getId()).orElseThrow(() ->
                new ResourceNotFoundException("INVENTORY_NOT_FOUND", "Inventory entry not found."));
    }

    private Pharmacy requirePharmacy(Long ownerId) {
        return pharmacies.findByOwnerId(ownerId).orElseThrow(() ->
                new ResourceNotFoundException("PHARMACY_NOT_REGISTERED", "Register your pharmacy first."));
    }

    private InventoryResponse toResponse(PharmacyInventory i) {
        return new InventoryResponse(i.getId(), MedicineResponse.from(i.getMedicine()), i.getQuantity(),
                i.getPrice(), i.isAvailable(), stockPolicy.status(i.getQuantity(), i.isAvailable()),
                i.getLastUpdatedAt(), stockPolicy.isStale(i.getLastUpdatedAt()));
    }
}
