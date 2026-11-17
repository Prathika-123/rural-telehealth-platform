package com.ruralhealth.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Turns what a person types ("Paracetamol 500mg") into a name part and an optional strength. */
public final class MedicineQueryParser {

    private static final Pattern TRAILING_STRENGTH = Pattern.compile(
            "^(.*\\S)\\s+(\\d+(?:\\.\\d+)?\\s*(?:mg|mcg|g|ml|iu|%))$", Pattern.CASE_INSENSITIVE);

    private MedicineQueryParser() { }

    /** strength is normalised (lower case, no spaces), or null when none was given. */
    public record ParsedQuery(String name, String strength) { }

    public static ParsedQuery parse(String query, String explicitStrength) {
        String q = query.trim();
        if (explicitStrength != null && !explicitStrength.isBlank()) {
            return new ParsedQuery(q, normaliseStrength(explicitStrength));
        }
        Matcher m = TRAILING_STRENGTH.matcher(q);
        if (m.matches()) {
            return new ParsedQuery(m.group(1).trim(), normaliseStrength(m.group(2)));
        }
        return new ParsedQuery(q, null);
    }

    public static String normaliseStrength(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    /** Builds a LIKE pattern, escaping % and _ so user input cannot act as a wildcard. Escape char is '!'. */
    public static String likePattern(String text) {
        String escaped = text.toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }
}
