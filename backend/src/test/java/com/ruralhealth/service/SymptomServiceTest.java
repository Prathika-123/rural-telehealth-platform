package com.ruralhealth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruralhealth.dto.response.SymptomContent;
import com.ruralhealth.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class SymptomServiceTest {

    private final SymptomService service = new SymptomService(new ObjectMapper());

    @Test
    void allThreeLanguagesLoadWithTheSameSymptoms() {
        var en = service.list("en");
        assertEquals("en", en.language());
        assertFalse(en.symptoms().isEmpty());
        for (String lang : List.of("kn", "hi")) {
            var other = service.list(lang);
            assertEquals(lang, other.language());
            assertEquals(en.symptoms().stream().map(s -> s.id()).toList(),
                    other.symptoms().stream().map(s -> s.id()).toList());
        }
    }

    @Test
    void kannadaAndHindiAreReallyInTheirOwnScripts() {
        Pattern kannada = Pattern.compile("[\\u0C80-\\u0CFF]");
        Pattern devanagari = Pattern.compile("[\\u0900-\\u097F]");
        assertTrue(kannada.matcher(service.get("fever", "kn").symptom().about()).find());
        assertTrue(devanagari.matcher(service.get("fever", "hi").symptom().about()).find());
    }

    @Test
    void unknownOrMissingLanguageFallsBackToEnglishAndSaysSo() {
        assertEquals("en", service.list("fr").language());
        assertEquals("en", service.list(null).language());
    }

    @Test
    void unknownSymptomIsNotFound() {
        assertEquals("SYMPTOM_NOT_FOUND",
                assertThrows(ResourceNotFoundException.class, () -> service.get("nope", "en")).getCode());
    }

    @Test
    void everyResponseCarriesTheDisclaimerReviewStatusAndEmergencyNumbers() {
        for (String lang : SymptomService.LANGUAGES) {
            var detail = service.get("fever", lang);
            assertFalse(detail.disclaimer().isBlank());
            assertFalse(detail.reviewStatus().isBlank());
            assertTrue(detail.emergencyGuidance().numbers().stream().anyMatch(n -> n.number().equals("112")));
        }
    }

    /** Guard for the safety rules: no medicine names, no dosing, in any educational text. */
    @Test
    void englishContentNamesNoMedicinesAndGivesNoDosing() {
        StringBuilder all = new StringBuilder();
        var list = service.list("en");
        list.symptoms().forEach(s -> {
            var d = service.get(s.id(), "en").symptom();
            all.append(d.name()).append(' ').append(d.about()).append(' ')
               .append(d.selfCare()).append(' ').append(d.seeDoctorIf()).append(' ').append(d.emergencyIf()).append(' ');
        });
        String text = all.toString().toLowerCase();
        for (String forbidden : List.of("paracetamol", "acetaminophen", "ibuprofen", "aspirin", "antibiotic",
                "amoxicillin", "crocin", "tablet", "capsule", "syrup", " mg", "dose", "dosage")) {
            assertFalse(text.contains(forbidden), "symptom text must not contain: " + forbidden);
        }
    }

    @Test
    void validationRejectsIncompleteLanguages() {
        Map<String, SymptomContent> all = new LinkedHashMap<>();
        var en = service.get("fever", "en");
        SymptomContent full = new SymptomContent("en", "X", "b", "d", en.emergencyGuidance(),
                List.of(en.symptom()));
        all.put("en", full);
        // a "kn" file that is missing the symptom
        all.put("kn", new SymptomContent("kn", "X", "b", "d", en.emergencyGuidance(), List.of()));
        assertThrows(IllegalStateException.class, () -> SymptomService.validate(all));
    }
}
