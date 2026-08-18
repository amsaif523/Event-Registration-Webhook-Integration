-- Refresh tokens: the long-lived, revocable half of the auth pair.
--
-- Access-token JWTs are self-contained and cannot be withdrawn before they
-- expire, so they are kept short-lived. This table is what makes "sign out"
-- and "revoke this session" actually mean something.
CREATE TABLE refresh_tokens (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    -- SHA-256 of the token, never the token itself. A leaked database dump
    -- must not hand over working sessions, exactly as with passwords.
    token_hash   CHAR(64)        NOT NULL,
    -- Tokens descending from one login share a family id. On reuse detection
    -- the whole family is revoked, not just the one token.
    family_id    CHAR(32)        NOT NULL,
    expires_at   DATETIME        NOT NULL,
    revoked_at   DATETIME        NULL,
    -- Set when this token is rotated, so presenting it a second time is
    -- detectable as replay rather than looking like an unknown token.
    replaced_by  CHAR(64)        NULL,
    user_agent   VARCHAR(255)    NULL,
    ip_address   VARCHAR(45)     NULL,
    created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_token_hash (token_hash),
    KEY idx_user (user_id),
    KEY idx_family (family_id),
    KEY idx_expires (expires_at),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
