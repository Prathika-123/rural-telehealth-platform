package com.ruralhealth.controller;

import com.ruralhealth.dto.request.MedicineRequest;
import com.ruralhealth.dto.response.MedicineResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.service.MedicineCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/medicines")
public class AdminMedicineController {

    private final MedicineCatalogService catalog;

    public AdminMedicineController(MedicineCatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public PageResponse<MedicineResponse> list(@RequestParam(required = false) String q,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size) {
        return catalog.list(q, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MedicineResponse create(@Valid @RequestBody MedicineRequest request) {
        return catalog.create(request);
    }

    @PutMapping("/{id}")
    public MedicineResponse update(@PathVariable Long id, @Valid @RequestBody MedicineRequest request) {
        return catalog.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        catalog.delete(id);
    }
}
