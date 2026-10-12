package com.powerpulse.user;

/** Password rules shared by create/update requests: at least 10 characters with a letter and a digit. */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 128;
    public static final String PATTERN = "^(?=.*\\p{L})(?=.*\\d).*$";
    public static final String MESSAGE = "must contain at least one letter and one digit";

    private PasswordPolicy() {
    }
}
