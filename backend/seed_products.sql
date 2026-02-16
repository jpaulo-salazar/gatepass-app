-- Example product data (Item No., Item Description, Item Group)
-- Run after init_db.sql. Uses INSERT IGNORE so existing item_codes are not duplicated.
-- Add or edit rows to match your full product list (e.g. from spreadsheet).

USE gate_pass_db;

INSERT IGNORE INTO products (item_code, item_description, item_group) VALUES
('AC.CF-COOL1', 'Coldfront 10L Round Air Cooler (Anion)', 'AIR COOLER'),
('AE.DVEHICLE-001', 'ISUZU FORWARD ALUMINUM WING VAN', 'AUTO EQUIPMENT'),
('AF.AF-TOP4.5G', '3-in-1 Air Fryer, Griller, Hotpot 4.5L Capacity; 8 preset program and DY function', 'AIR FRYER'),
('AF.KUCHEN4.2', 'Kuchenluxe 4.2L Air Fryer with Grill, 1500W, adjustable temp. and with 30mins. timer', 'AIR FRYER'),
('SAMPLE.001', 'Sample product item', 'SAMPLE');

-- Add more rows following the same pattern:
-- ('ItemNo', 'Item Description', 'Item Group'),
