-- Department encoding: master list per system; users.department_id FK.
-- Run after 010 (or any schema with users.department VARCHAR).
-- Safe pieces: CREATE IF NOT EXISTS; ALTERs may error if already applied.

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    `system` VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_department_name_system (name(191), `system`)
);

-- Add FK column (ignore error if column already exists)
ALTER TABLE users ADD COLUMN department_id INT NULL AFTER full_name;

-- Migrate legacy free-text department into encoded rows
INSERT IGNORE INTO departments (name, `system`)
SELECT DISTINCT TRIM(u.department), u.`system` FROM users u
WHERE u.department IS NOT NULL AND TRIM(u.department) != '';

UPDATE users u
INNER JOIN departments d ON TRIM(u.department) = d.name AND u.`system` = d.`system`
SET u.department_id = d.id
WHERE u.department IS NOT NULL AND TRIM(u.department) != '' AND u.department_id IS NULL;

ALTER TABLE users DROP COLUMN department;

ALTER TABLE users
    ADD CONSTRAINT fk_users_department_id FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
