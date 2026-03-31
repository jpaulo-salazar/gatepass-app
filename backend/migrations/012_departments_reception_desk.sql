-- Mark which department(s) staff the reception desk scan (transmittal receptionist page).

ALTER TABLE departments
    ADD COLUMN is_reception_desk TINYINT(1) NOT NULL DEFAULT 0 AFTER name;
