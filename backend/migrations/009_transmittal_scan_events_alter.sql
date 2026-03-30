-- Existing Gate Pass / Transmittal DBs: add IN-transmittal scan audit table only.
-- Requires `transmittals` (006). No ALTER to `transmittals`; new child table only.
-- Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS transmittal_scan_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transmittal_id INT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    user_full_name VARCHAR(255) NULL,
    FOREIGN KEY (transmittal_id) REFERENCES transmittals(id) ON DELETE CASCADE,
    KEY idx_transmittal_scan_events_transmittal (transmittal_id),
    KEY idx_transmittal_scan_events_created (created_at)
);
