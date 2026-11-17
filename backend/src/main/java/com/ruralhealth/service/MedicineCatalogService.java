package com.ruralhealth.service;

import com.ruralhealth.dto.request.MedicineRequest;
import com.ruralhealth.dto.response.MedicineResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.entity.Medicine;
import com.ruralhealth.exception.DuplicateResourceException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.MedicineRepository;
import com.ruralhealth.repository.PharmacyInventoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MedicineCatalogService {

    private static final Logger log = LoggerFactory.getLogger(MedicineCatalogService.class);
    private static final String SUGGEST_CACHE = "medicineSuggestions";

    private final MedicineRepository medicines;
    private final PharmacyInventoryRepository inventory;

    public MedicineCatalogService(MedicineRepository medicines, PharmacyInventoryRepository inventory) {
        this.medicines = medicines;
        this.inventory = inventory;
    }

    /**
     * Autocomplete. Cached because it is called on every keystroke and depends only on the catalogue
     * (no location, no stock). Any catalogue change evicts the whole cache.
     */
    @Cacheable(cacheNames = SUGGEST_CACHE, key = "#query.trim().toLowerCase()")
    @Transactional(readOnly = true)
    public List<MedicineResponse> suggest(String query) {
        return medicines.findByGenericNameContainingIgnoreCaseOrBrandNameContainingIgnoreCase(
                        query.trim(), query.trim(), PageRequest.of(0, 10, Sort.by("genericName", "strength")))
                .getContent().stream().map(MedicineResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<MedicineResponse> list(String query, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50),
                Sort.by("genericName", "strength"));
        String q = query == null ? "" : query.trim();
        return PageResponse.from(
                medicines.findByGenericNameContainingIgnoreCaseOrBrandNameContainingIgnoreCase(q, q, pr),
                MedicineResponse::from);
    }

    @CacheEvict(cacheNames = SUGGEST_CACHE, allEntries = true)
    @Transactional
    public MedicineResponse create(MedicineRequest req) {
        if (medicines.existsByBrandNameIgnoreCaseAndGenericNameIgnoreCaseAndStrengthIgnoreCaseAndDosageFormIgnoreCase(
                req.brandName().trim(), req.genericName().trim(), req.strength().trim(), req.dosageForm().trim())) {
            throw new DuplicateResourceException("MEDICINE_ALREADY_EXISTS", "This medicine is already in the catalogue.");
        }
        Medicine m = new Medicine();
        apply(m, req);
        medicines.save(m);
        log.info("Medicine created: id={}", m.getId());
        return MedicineResponse.from(m);
    }

    @CacheEvict(cacheNames = SUGGEST_CACHE, allEntries = true)
    @Transactional
    public MedicineResponse update(Long id, MedicineRequest req) {
        Medicine m = find(id);
        apply(m, req);
        return MedicineResponse.from(m);
    }

    @CacheEvict(cacheNames = SUGGEST_CACHE, allEntries = true)
    @Transactional
    public void delete(Long id) {
        Medicine m = find(id);
        if (inventory.existsByMedicineId(id)) {
            throw new DuplicateResourceException("MEDICINE_IN_USE",
                    "This medicine is stocked by a pharmacy and cannot be deleted.");
        }
        medicines.delete(m);
        log.info("Medicine deleted: id={}", id);
    }

    private void apply(Medicine m, MedicineRequest req) {
        m.setBrandName(req.brandName().trim());
        m.setGenericName(req.genericName().trim());
        m.setStrength(req.strength().trim());
        m.setDosageForm(req.dosageForm().trim());
        m.setPrescriptionRequired(Boolean.TRUE.equals(req.prescriptionRequired()));
    }

    private Medicine find(Long id) {
        return medicines.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MEDICINE_NOT_FOUND", "Medicine not found."));
    }
}
