-- Recipient department id (from assigned employee) for transmittal form assignment and receptionist confirm flow.
ALTER TABLE transmittals
  ADD COLUMN recipient_department_id INT NULL AFTER recipient_name;
