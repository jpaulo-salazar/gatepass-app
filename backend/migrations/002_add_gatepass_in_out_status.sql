-- Add in_or_out, status, rejected_remarks to gate_passes (run once on existing DBs; new installs use init_db.sql)
ALTER TABLE gate_passes ADD COLUMN in_or_out VARCHAR(10) DEFAULT 'out';
ALTER TABLE gate_passes ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE gate_passes ADD COLUMN rejected_remarks TEXT;
