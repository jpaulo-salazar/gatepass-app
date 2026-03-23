-- Document Transmittal System: transmittals and line items
-- Barcode/ID format: same as gate pass (YYYYNNNN, e.g. 20260001), separate sequence per year.

CREATE TABLE IF NOT EXISTS transmittals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transmittal_number VARCHAR(50) UNIQUE NOT NULL,
    transmittal_date DATE NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    in_or_out VARCHAR(10) DEFAULT 'out',
    status VARCHAR(20) DEFAULT 'pending',
    rejected_remarks TEXT,
    purpose_return TINYINT(1) DEFAULT 0,
    purpose_inter_warehouse TINYINT(1) DEFAULT 0,
    purpose_others TINYINT(1) DEFAULT 0,
    vehicle_type VARCHAR(100),
    plate_no VARCHAR(50),
    truck_seal_no VARCHAR(100),
    prepared_by VARCHAR(255),
    checked_by VARCHAR(255),
    approved_by VARCHAR(255),
    recommended_by VARCHAR(255),
    time_out VARCHAR(20),
    time_in VARCHAR(20),
    date_approved DATE NULL,
    received_by_receptionist_at DATETIME NULL,
    received_by_recipient_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transmittal_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transmittal_id INT NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    qty INT NOT NULL,
    ref_doc_no VARCHAR(100),
    destination VARCHAR(255),
    FOREIGN KEY (transmittal_id) REFERENCES transmittals(id) ON DELETE CASCADE
);
