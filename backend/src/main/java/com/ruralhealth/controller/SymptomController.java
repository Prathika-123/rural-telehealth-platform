package com.ruralhealth.controller;

import com.ruralhealth.dto.response.EmergencyResponse;
import com.ruralhealth.dto.response.SymptomDetailResponse;
import com.ruralhealth.dto.response.SymptomListResponse;
import com.ruralhealth.service.SymptomService;
import org.springframework.web.bind.annotation.*;

/** Public, read-only, educational information. No symptom checker, no diagnosis. */
@RestController
@RequestMapping("/api/v1/symptoms")
public class SymptomController {

    private final SymptomService symptoms;

    public SymptomController(SymptomService symptoms) {
        this.symptoms = symptoms;
    }

    @GetMapping
    public SymptomListResponse list(@RequestParam(defaultValue = "en") String lang) {
        return symptoms.list(lang);
    }

    @GetMapping("/emergency")
    public EmergencyResponse emergency(@RequestParam(defaultValue = "en") String lang) {
        return symptoms.emergency(lang);
    }

    @GetMapping("/{id}")
    public SymptomDetailResponse details(@PathVariable String id, @RequestParam(defaultValue = "en") String lang) {
        return symptoms.get(id, lang);
    }
}
