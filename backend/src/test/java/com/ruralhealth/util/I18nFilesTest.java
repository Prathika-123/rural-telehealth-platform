package com.ruralhealth.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/** Keeps the three frontend translation files in step. Runs from the backend/ folder (mvn test). */
class I18nFilesTest {

    private static final Path DIR = Path.of("..", "frontend", "js", "i18n");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\w+}");

    private Map<String, String> load(String lang) throws Exception {
        return new ObjectMapper().readValue(Files.readString(DIR.resolve(lang + ".json")), new TypeReference<>() { });
    }

    private static String placeholders(String s) {
        TreeSet<String> set = new TreeSet<>();
        Matcher m = PLACEHOLDER.matcher(s);
        while (m.find()) set.add(m.group());
        return set.toString();
    }

    @Test
    void allLanguagesHaveTheSameKeysNonEmptyValuesAndPlaceholders() throws Exception {
        Assumptions.assumeTrue(Files.isDirectory(DIR), "frontend folder not found next to backend/");
        Map<String, String> en = load("en");
        for (String lang : new String[]{"kn", "hi"}) {
            Map<String, String> other = load(lang);
            assertEquals(new TreeSet<>(en.keySet()), new TreeSet<>(other.keySet()), lang + " keys differ from en");
            other.forEach((k, v) -> {
                assertFalse(v.isBlank(), lang + ":" + k + " is empty");
                assertEquals(placeholders(en.get(k)), placeholders(v), lang + ":" + k + " placeholders differ");
            });
        }
    }
}
