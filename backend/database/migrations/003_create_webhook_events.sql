-- Every inbound webhook is logged here, accepted or rejected. This table is
-- the audit trail: being able to show why a signature failed is worth as much
-- as showing a delivery that worked.
CREATE TABLE webhook_events (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    -- From the X-Webhook-Id header, or a SHA-256 of the raw body when absent.
    -- The UNIQUE key on it is the idempotency mechanism: we insert first and
    -- let a duplicate-key error tell us this is a repeat delivery, rather than
    -- checking-then-inserting and losing the race.
    delivery_id            VARCHAR(100)    NOT NULL,
    event_type             VARCHAR(100)    NOT NULL,
    registration_reference VARCHAR(20)     NULL,
    payload                TEXT            NOT NULL,
    signature              VARCHAR(255)    NULL,
    status                 ENUM('processed', 'duplicate', 'invalid_signature', 'failed') NOT NULL,
    error_message          TEXT            NULL,
    received_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at           DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_delivery_id (delivery_id),
    KEY idx_reference (registration_reference),
    KEY idx_status_received (status, received_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
