package com.ruralhealth.exception;

import org.springframework.http.HttpStatus;

/** Base for all expected, client-facing errors. The code is a stable key the frontend translates. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
