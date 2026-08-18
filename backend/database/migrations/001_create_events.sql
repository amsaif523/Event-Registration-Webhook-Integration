-- Events. Only `published` events accept registrations.
CREATE TABLE events (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(255)    NOT NULL,
    description   TEXT            NULL,
    -- `date` is awkward across engines and reads ambiguously; be explicit.
    event_date    DATETIME        NOT NULL,
    venue         VARCHAR(255)    NOT NULL,
    capacity      INT UNSIGNED    NOT NULL,
    status        ENUM('draft', 'published', 'closed', 'cancelled') NOT NULL DEFAULT 'draft',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- The public list filters on status and orders by date; one index serves both.
    KEY idx_status_date (status, event_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
