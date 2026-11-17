package com.ruralhealth.service;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.response.MedicineResponse;
import com.ruralhealth.dto.response.MedicineSearchResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.PharmacyAvailabilityResponse;
import com.ruralhealth.entity.Pharmacy;
import com.ruralhealth.entity.PharmacyInventory;
import com.ruralhealth.entity.VerificationStatus;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.repository.MedicineRepository;
import com.ruralhealth.repository.PharmacyInventoryRepository;
import com.ruralhealth.util.GeoUtils;
import com.ruralhealth.util.MedicineQueryParser;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Location-based medicine search.
 * Not cached on purpose: results depend on the user's position (which we do not want to store, even
 * in a cache key) and on stock, which must never be served older than necessary.
 */
@Service
public class MedicineSearchService {

    private final PharmacyInventoryRepository inventory;
    private final MedicineRepository medicines;
    private final StockPolicy stockPolicy;
    private final AppProperties.Search cfg;

    public MedicineSearchService(PharmacyInventoryRepository inventory, MedicineRepository medicines,
                                 StockPolicy stockPolicy, AppProperties props) {
        this.inventory = inventory;
        this.medicines = medicines;
        this.stockPolicy = stockPolicy;
        this.cfg = props.searchOrDefault();
    }

    private record Hit(PharmacyInventory item, double distanceKm) { }

    @Transactional(readOnly = true)
    public MedicineSearchResponse search(String q, String strength, Double lat, Double lng,
                                         Double radiusKm, int page, int size) {
        if (q == null || q.trim().length() < 2 || q.trim().length() > 100) {
            throw new BadRequestException("QUERY_INVALID", "Enter 2 to 100 characters of the medicine name.");
        }
        GeoUtils.validateCoordinates(lat, lng);
        double radius = resolveRadius(radiusKm);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);

        MedicineQueryParser.ParsedQuery parsed = MedicineQueryParser.parse(q, strength);
        String pattern = MedicineQueryParser.likePattern(parsed.name());
        GeoUtils.BoundingBox box = GeoUtils.boundingBox(lat, lng, radius);
        PageRequest cap = PageRequest.of(0, cfg.maxCandidates());

        // 1) cheap, index-friendly SQL narrowing: name + stock + verified + bounding box
        List<PharmacyInventory> rows = parsed.strength() == null
                ? inventory.searchAvailable(pattern, VerificationStatus.VERIFIED,
                        box.minLat(), box.maxLat(), box.minLng(), box.maxLng(), cap)
                : inventory.searchAvailableWithStrength(pattern, parsed.strength(), VerificationStatus.VERIFIED,
                        box.minLat(), box.maxLat(), box.minLng(), box.maxLng(), cap);

        // 2) exact Haversine distance, drop anything outside the radius, nearest first
        List<Hit> hits = rows.stream()
                .map(i -> new Hit(i, GeoUtils.haversineKm(lat, lng,
                        i.getPharmacy().getLatitude().doubleValue(), i.getPharmacy().getLongitude().doubleValue())))
                .filter(h -> h.distanceKm() <= radius)
                .sorted(Comparator.comparingDouble(Hit::distanceKm)
                        .thenComparing(h -> h.item().getPharmacy().getName()))
                .toList();

        // 3) page the sorted list
        int total = hits.size();
        int from = (int) Math.min((long) safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        List<PharmacyAvailabilityResponse> content = hits.subList(from, to).stream().map(this::toDto).toList();
        PageResponse<PharmacyAvailabilityResponse> pageResponse = new PageResponse<>(
                content, safePage, safeSize, total, (int) Math.ceil(total / (double) safeSize));

        return new MedicineSearchResponse(statusFor(total, pattern, parsed.strength()), parsed.name(),
                parsed.strength(), radius, stockPolicy.staleAfterDays(), pageResponse);
    }

    /** Separates "no such medicine" from "medicine exists but nobody nearby has it". */
    private String statusFor(int total, String pattern, String strength) {
        if (total > 0) return "RESULTS";
        long known = strength == null ? medicines.countMatching(pattern)
                : medicines.countMatchingWithStrength(pattern, strength);
        return known > 0 ? "NO_PHARMACY_NEARBY" : "MEDICINE_NOT_FOUND";
    }

    private double resolveRadius(Double requested) {
        if (requested == null) return cfg.defaultRadiusKm();
        if (!(requested > 0)) {
            throw new BadRequestException("INVALID_RADIUS", "Search radius must be greater than zero.");
        }
        return Math.min(requested, cfg.maxRadiusKm());
    }

    private PharmacyAvailabilityResponse toDto(Hit hit) {
        PharmacyInventory i = hit.item();
        Pharmacy p = i.getPharmacy();
        return new PharmacyAvailabilityResponse(p.getId(), p.getName(), p.getAddress(), p.getTaluk(), p.getDistrict(),
                p.getPhone(), p.getLatitude(), p.getLongitude(), Math.round(hit.distanceKm() * 100) / 100.0,
                MedicineResponse.from(i.getMedicine()), i.getPrice(),
                stockPolicy.status(i.getQuantity(), i.isAvailable()),
                i.getLastUpdatedAt(), stockPolicy.isStale(i.getLastUpdatedAt()));
    }
}
