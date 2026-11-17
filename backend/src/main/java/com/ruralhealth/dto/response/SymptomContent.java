package com.ruralhealth.dto.response;

import java.util.List;

/** Shape of the curated symptom JSON files, which are also returned directly by the API. */
public record SymptomContent(String language, String reviewStatus, String basis, String disclaimer,
                             Emergency emergency, List<Symptom> symptoms) {

    public record Symptom(String id, String name, boolean emergency, String about,
                          List<String> selfCare, List<String> seeDoctorIf, List<String> emergencyIf) { }

    public record Emergency(String title, String intro, List<String> signs, List<String> actions,
                            List<EmergencyNumber> numbers) { }

    public record EmergencyNumber(String number, String label) { }
}
