package com.ruralhealth.controller;

import com.ruralhealth.dto.response.MedicineResponse;
import com.ruralhealth.dto.response.MedicineSearchResponse;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.service.MedicineCatalogService;
import com.ruralhealth.service.MedicineSearchService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Public medicine endpoints: no login needed to find a medicine. */
@RestController
@RequestMapping("/api/v1/medicines")
public class MedicineController {

    private final MedicineSearchService searchService;
    private final MedicineCatalogService catalog;

    public MedicineController(MedicineSearchService searchService, MedicineCatalogService catalog) {
        this.searchService = searchService;
        this.catalog = catalog;
    }

    @GetMapping("/search")
    public MedicineSearchResponse search(@RequestParam String q,
                                         @RequestParam(required = false) String strength,
                                         @RequestParam(required = false) Double lat,
                                         @RequestParam(required = false) Double lng,
                                         @RequestParam(required = false) Double radiusKm,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "10") int size) {
        return searchService.search(q, strength, lat, lng, radiusKm, page, size);
    }

    @GetMapping("/suggest")
    public List<MedicineResponse> suggest(@RequestParam String q) {
        if (q.trim().length() < 2) {
            throw new BadRequestException("QUERY_INVALID", "Enter at least 2 characters.");
        }
        return catalog.suggest(q);
    }
}
