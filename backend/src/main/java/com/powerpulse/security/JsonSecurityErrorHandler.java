package com.powerpulse.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.powerpulse.common.ApiError;
import com.powerpulse.common.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;

/** Writes {@link ApiError} JSON for 401 (entry point) and 403 (access denied, including CSRF failures). */
public class JsonSecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final String unauthorizedMessage;

    public JsonSecurityErrorHandler(ObjectMapper objectMapper, String unauthorizedMessage) {
        this.objectMapper = objectMapper;
        this.unauthorizedMessage = unauthorizedMessage;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex)
            throws IOException {
        write(response, GlobalExceptionHandler.body(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", unauthorizedMessage,
                request.getRequestURI()));
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
            throws IOException {
        String message = ex instanceof CsrfException
                ? "Missing or invalid CSRF token"
                : "You do not have permission to perform this action";
        write(response, GlobalExceptionHandler.body(HttpStatus.FORBIDDEN, "FORBIDDEN", message,
                request.getRequestURI()));
    }

    private void write(HttpServletResponse response, ApiError error) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(error.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), error);
    }
}
