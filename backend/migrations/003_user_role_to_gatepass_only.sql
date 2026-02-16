-- Optional: update legacy role 'user' to 'gatepass_only' for consistency with new user types.
-- Safe to run multiple times. Only affects rows where role = 'user'.
UPDATE users SET role = 'gatepass_only' WHERE role = 'user';
