package com.ruralhealth.dto.response;

import java.util.List;

public record SymptomListResponse(String language, String reviewStatus, String disclaimer,
                                  List<Summary> symptoms) {
    public record Summary(String id, String name, boolean emergency) { }
}
