-- Registrations. Created as `pending`; the ticketing webhook confirms them.
CREATE TABLE registrations (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id      BIGINT UNSIGNED NOT NULL,
    -- EVT-XXXXXXXX. Random, not sequential: it is the only credential needed
    -- to look up a registration, so a guessable one would let anyone walk the
    -- entire list.
    reference     VARCHAR(20)     NOT NULL,
    first_name    VARCHAR(100)    NOT NULL,
    last_name     VARCHAR(100)    NOT NULL,
    email         VARCHAR(255)    NOT NULL,
    phone         VARCHAR(30)     NOT NULL,
    status        ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
    ticket_id     VARCHAR(64)     NULL,
    confirmed_at  DATETIME        NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_reference (reference),
    -- One registration per email per event, enforced by the database rather
    -- than by a check the application could race against.
    UNIQUE KEY uniq_event_email (event_id, email),
    KEY idx_event_status (event_id, status),
    CONSTRAINT fk_registrations_event
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
