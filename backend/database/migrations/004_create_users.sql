-- Admin accounts.
--
-- CLAUDE.md section 6 specified a single shared ADMIN_TOKEN and listed real
-- accounts under known limitations. This replaces that: named accounts, hashed
-- passwords, and per-account lockout. The shared-token path is gone.
CREATE TABLE users (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name           VARCHAR(100)    NOT NULL,
    username       VARCHAR(100)    NOT NULL,
    email          VARCHAR(255)    NOT NULL,
    -- password_hash() output. 255 chars leaves room for whatever PASSWORD_DEFAULT
    -- becomes in a future PHP release.
    password_hash  VARCHAR(255)    NOT NULL,
    role           ENUM('admin')   NOT NULL DEFAULT 'admin',
    -- Brute-force throttling, per account.
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until   DATETIME        NULL,
    last_login_at  DATETIME        NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_username (username),
    UNIQUE KEY uniq_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
