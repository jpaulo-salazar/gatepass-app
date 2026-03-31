-- OUT-only transmittal scan flow enhancements.
-- 1) Add users.department for recipient assignment metadata.
-- 2) Add recipient assignment columns on transmittals.

ALTER TABLE users
    ADD COLUMN department VARCHAR(255) NULL AFTER full_name;

ALTER TABLE transmittals
    ADD COLUMN recipient_department VARCHAR(255) NULL AFTER received_by_receptionist_name,
    ADD COLUMN recipient_user_id INT NULL AFTER recipient_department,
    ADD COLUMN recipient_user_name VARCHAR(255) NULL AFTER recipient_user_id;
