-- Add received-by names for IN flow (receptionist and recipient).
-- Run after 006. If columns already exist (e.g. from init_db), skip or ignore errors.
ALTER TABLE transmittals ADD COLUMN received_by_receptionist_name VARCHAR(255) NULL AFTER received_by_receptionist_at;
ALTER TABLE transmittals ADD COLUMN received_by_recipient_name VARCHAR(255) NULL AFTER received_by_recipient_at;
