package com.ruralhealth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruralhealth.dto.response.*;
import com.ruralhealth.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Serves curated, static symptom information from classpath JSON files (symptoms/symptoms-{lang}.json).
 * Nothing is generated at runtime, nothing is diagnosed and no medicine is recommended.
 * The files are validated at startup: the application refuses to start if a language is incomplete,
 * so a user can never see a half-translated health page.
 */
@Service
public class SymptomService {

    private static final Logger log = LoggerFactory.getLogger(SymptomService.class);
    public static final List<String> LANGUAGES = List.of("en", "kn", "hi");
    private static final String DEFAULT_LANGUAGE = "en";

    private final Map<String, SymptomContent> content = new LinkedHashMap<>();

    public SymptomService(ObjectMapper mapper) {
        for (String lang : LANGUAGES) {
            try (InputStream in = new ClassPathResource("symptoms/symptoms-" + lang + ".json").getInputStream()) {
                content.put(lang, mapper.readValue(in, SymptomContent.class));
            } catch (IOException e) {
                throw new IllegalStateException("Cannot load symptom content for language " + lang, e);
            }
        }
        validate(content);
        log.info("Symptom content loaded for {} languages ({} symptoms each)", content.size(),
                content.get(DEFAULT_LANGUAGE).symptoms().size());
    }

    public SymptomListResponse list(String lang) {
        SymptomContent c = forLanguage(lang);
        return new SymptomListResponse(c.language(), c.reviewStatus(), c.disclaimer(),
                c.symptoms().stream().map(s -> new SymptomListResponse.Summary(s.id(), s.name(), s.emergency())).toList());
    }

    public SymptomDetailResponse get(String id, String lang) {
        SymptomContent c = forLanguage(lang);
        SymptomContent.Symptom s = c.symptoms().stream().filter(x -> x.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("SYMPTOM_NOT_FOUND", "Symptom information not found."));
        return new SymptomDetailResponse(c.language(), c.reviewStatus(), c.disclaimer(), s, c.emergency());
    }

    public EmergencyResponse emergency(String lang) {
        SymptomContent c = forLanguage(lang);
        return new EmergencyResponse(c.language(), c.reviewStatus(), c.disclaimer(), c.emergency());
    }

    /** Unknown or missing language falls back to English; the response says which language was served. */
    private SymptomContent forLanguage(String lang) {
        String key = lang == null ? DEFAULT_LANGUAGE : lang.trim().toLowerCase();
        return content.getOrDefault(key, content.get(DEFAULT_LANGUAGE));
    }

    static void validate(Map<String, SymptomContent> all) {
        SymptomContent en = all.get(DEFAULT_LANGUAGE);
        Set<String> expectedIds = en.symptoms().stream().map(SymptomContent.Symptom::id).collect(Collectors.toSet());
        for (Map.Entry<String, SymptomContent> e : all.entrySet()) {
            String lang = e.getKey();
            SymptomContent c = e.getValue();
            require(lang.equals(c.language()), lang, "language field does not match file name");
            require(notBlank(c.reviewStatus()) && notBlank(c.disclaimer()), lang, "missing review status or disclaimer");
            require(c.emergency() != null && notBlank(c.emergency().title()) && notEmpty(c.emergency().signs())
                    && notEmpty(c.emergency().actions()) && notEmpty(c.emergency().numbers()), lang, "incomplete emergency section");
            Set<String> ids = c.symptoms().stream().map(SymptomContent.Symptom::id).collect(Collectors.toSet());
            require(ids.equals(expectedIds), lang, "symptom ids differ from English");
            for (SymptomContent.Symptom s : c.symptoms()) {
                require(notBlank(s.name()) && notBlank(s.about()) && notEmpty(s.selfCare())
                        && notEmpty(s.seeDoctorIf()) && notEmpty(s.emergencyIf()), lang, "incomplete symptom " + s.id());
            }
        }
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
    private static boolean notEmpty(List<?> l) { return l != null && !l.isEmpty(); }
    private static void require(boolean ok, String lang, String message) {
        if (!ok) throw new IllegalStateException("Invalid symptom content (" + lang + "): " + message);
    }
}
