-- Seed default Transmittal reception desk department (safe to re-run).
-- Requires departments table with is_reception_desk (migration 012).

INSERT IGNORE INTO departments (name, is_reception_desk, `system`)
VALUES ('Receptionist', 1, 'transmittal');
