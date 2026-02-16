-- Gate Pass App - Database and tables setup
-- Run this script in MySQL/MariaDB (e.g. via HeidiSQL) to create the database and schema.
-- Default admin user (admin / admin123) is created by the application on first run.
-- WARNING: DROP TABLE removes all data. Use only for fresh install or reset.

CREATE DATABASE IF NOT EXISTS gate_pass_db;
USE gate_pass_db;

-- Drop tables if they exist (child tables first due to foreign keys)
DROP TABLE IF EXISTS gate_pass_items;
DROP TABLE IF EXISTS gate_passes;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- Users (login and user encoding)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'gatepass_only',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products (product encoding - item no., description, group)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(100) UNIQUE NOT NULL,
    item_description VARCHAR(500) NOT NULL,
    item_group VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate passes (header and metadata)
CREATE TABLE gate_passes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gp_number VARCHAR(50) UNIQUE NOT NULL,
    pass_date DATE NOT NULL,
    authorized_name VARCHAR(255) NOT NULL,
    in_or_out VARCHAR(10) DEFAULT 'out',
    status VARCHAR(20) DEFAULT 'pending',
    rejected_remarks TEXT,
    purpose_delivery TINYINT(1) DEFAULT 1,
    purpose_return TINYINT(1) DEFAULT 0,
    purpose_inter_warehouse TINYINT(1) DEFAULT 0,
    purpose_others TINYINT(1) DEFAULT 0,
    vehicle_type VARCHAR(100),
    plate_no VARCHAR(50),
    attention VARCHAR(255),
    prepared_by VARCHAR(255),
    checked_by VARCHAR(255),
    recommended_by VARCHAR(255),
    approved_by VARCHAR(255),
    time_out VARCHAR(20),
    time_in VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gate pass line items
CREATE TABLE gate_pass_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gate_pass_id INT NOT NULL,
    item_code VARCHAR(100),
    item_description VARCHAR(500) NOT NULL,
    qty INT NOT NULL,
    ref_doc_no VARCHAR(100),
    destination VARCHAR(255),
    FOREIGN KEY (gate_pass_id) REFERENCES gate_passes(id) ON DELETE CASCADE
);
