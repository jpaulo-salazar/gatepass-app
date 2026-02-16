-- Add attention column to gate_passes (run once; skip if column already exists)
ALTER TABLE gate_passes ADD COLUMN attention VARCHAR(255);
