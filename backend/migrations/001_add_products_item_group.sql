-- Migration: Add item_group to products table
-- Run this if you already have gate_pass_db and products table without item_group.
-- New installs using init_db.sql already include item_group.
-- If you get "Duplicate column name 'item_group'", the column already exists; skip this.

USE gate_pass_db;

ALTER TABLE products ADD COLUMN item_group VARCHAR(100) NULL AFTER item_description;
