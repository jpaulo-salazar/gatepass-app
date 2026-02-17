-- Add date_approved to gate_passes (set when admin approves)
ALTER TABLE gate_passes ADD COLUMN date_approved DATE NULL;
