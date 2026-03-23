# Transmittal deployment (existing Gate Pass database)

Use this guide when **Gate Pass is already in production** and you are adding **Document Transmittal** only.

---

## Prerequisites

- MySQL/MariaDB with the existing Gate Pass schema and data.
- Backend `.env` points at the same database (see `backend/.env`: `MYSQL_*`).
- After SQL: deploy the **new** backend and frontend that include Transmittal.

---

## 1. Run SQL in this order

Run scripts in a MySQL client (HeidiSQL, MySQL Workbench, CLI). Use the **same database** as Gate Pass.

### Step A — `users` table: `system` column (required first)

**File:** `backend/migrations/008_users_system_column.sql`

If **`system` already exists** (e.g. you ran this before), **skip Step A**.

```sql
-- Add system column (default gatepass for existing rows)
ALTER TABLE users ADD COLUMN `system` VARCHAR(20) NOT NULL DEFAULT 'gatepass';

-- Replace UNIQUE(username) with UNIQUE(username, system)
-- MySQL may name the old unique index "username" — if DROP fails, see Troubleshooting below.
ALTER TABLE users DROP INDEX username;
ALTER TABLE users ADD UNIQUE KEY unique_username_system (username, `system`);
```

**After Step A:** every existing user has `system = 'gatepass'`. Gate Pass behavior stays the same.

---

### Step B — Transmittal tables

**File:** `backend/migrations/006_transmittals.sql`

```sql
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
```

---

### Step C — Receptionist / recipient name columns

**File:** `backend/migrations/007_transmittals_received_by_names.sql`

Run **after** Step B. If columns **already exist**, skip this step (or ignore “duplicate column” errors).

```sql
ALTER TABLE transmittals ADD COLUMN received_by_receptionist_name VARCHAR(255) NULL AFTER received_by_receptionist_at;
ALTER TABLE transmittals ADD COLUMN received_by_recipient_name VARCHAR(255) NULL AFTER received_by_recipient_at;
```

---

## 2. Create Transmittal admin account

Passwords are **bcrypt** in the database. Use the provided script (recommended).

### Option A — Python script (recommended)

From the **`backend`** folder, with virtualenv activated and `.env` configured:

**Windows**

```bat
cd backend
venv\Scripts\activate
python scripts\create_transmittal_admin.py
```

**Linux / macOS**

```bash
cd backend
source venv/bin/activate
python scripts/create_transmittal_admin.py
```

**Resulting account**

| Field    | Value        |
|----------|--------------|
| Username | `admin`      |
| Password | `admin`      |
| System   | `transmittal`|
| Role     | `admin`      |

The script is **idempotent**: running it again updates the password back to `admin` for that user.

> **Security:** Change this password after first login in production.

### Option B — Copy hash from Gate Pass admin (SQL only)

Only if you already have a Gate Pass `admin` and want the **same password** as that account (not necessarily `admin`):

```sql
INSERT INTO users (username, password_hash, full_name, role, `system`)
SELECT 'admin', password_hash, 'Transmittal Admin', 'admin', 'transmittal'
FROM users WHERE username = 'admin' AND `system` = 'gatepass' LIMIT 1
ON DUPLICATE KEY UPDATE id = id;
```

Adjust `username` in the `SELECT` if your Gate Pass admin username differs.

---

## 3. Deploy application

1. Deploy/update **backend** (FastAPI) with Transmittal routes and dependencies.
2. Deploy/update **frontend** (build + host static files or dev proxy as you do today).
3. Users open **Transmittal** from the portal: `/` → Transmittal, or go directly to **`/transmittal/login`**.

---

## Troubleshooting

### `DROP INDEX username` fails (008)

The unique index on `username` may have another name. Inspect:

```sql
SHOW INDEX FROM users;
```

Drop the index that is **only** on `username` (non-composite), then run:

```sql
ALTER TABLE users ADD UNIQUE KEY unique_username_system (username, `system`);
```

### `Duplicate column name` on 007

`received_by_receptionist_name` / `received_by_recipient_name` already exist — skip Step C.

### `Duplicate entry` on admin script / SQL

`(username, system)` must be unique. If `admin` + `transmittal` already exists, the Python script updates that row; for raw SQL, use `ON DUPLICATE KEY UPDATE` or delete the row first if you intend to recreate it.

---

## Quick checklist

- [ ] **008** — `users`.`system` + unique `(username, system)` (skip if already applied)
- [ ] **006** — `transmittals`, `transmittal_items`
- [ ] **007** — name columns on `transmittals` (skip if already present)
- [ ] Transmittal admin created (script or SQL)
- [ ] Backend + frontend deployed
- [ ] Test login at `/transmittal/login`

---

## Reference file paths (repo)

| Order | File |
|------|------|
| A | `backend/migrations/008_users_system_column.sql` |
| B | `backend/migrations/006_transmittals.sql` |
| C | `backend/migrations/007_transmittals_received_by_names.sql` |
| Admin | `backend/scripts/create_transmittal_admin.py` |
