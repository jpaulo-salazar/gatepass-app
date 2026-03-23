-- For existing / production databases: add system column to users (Gate Pass already in production).
-- Use single users table for both Gate Pass and Transmittal. (username, `system`) unique.

-- Add system column (default gatepass for existing rows)
ALTER TABLE users ADD COLUMN `system` VARCHAR(20) NOT NULL DEFAULT 'gatepass';

-- Replace UNIQUE(username) with UNIQUE(username, system)
-- MySQL names the unique key on username as "username"
ALTER TABLE users DROP INDEX username;
ALTER TABLE users ADD UNIQUE KEY unique_username_system (username, `system`);

-- Optional: add default transmittal admin if you want one (same password as gate pass admin)
-- INSERT INTO users (username, password_hash, full_name, role, `system`)
-- SELECT 'admin', password_hash, 'Transmittal Admin', 'admin', 'transmittal'
-- FROM users WHERE username = 'admin' AND `system` = 'gatepass' LIMIT 1
-- ON DUPLICATE KEY UPDATE id=id;
