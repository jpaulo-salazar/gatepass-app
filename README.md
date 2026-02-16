# Gate Pass App – CHERENZ GLOBAL MFG. INC.

Digital gate pass form with barcode generation and scan-to-display. Built with **React**, **Python (FastAPI)**, and **MySQL**.

## Features

- **Login** – Authenticate to access the app (default: `admin` / `admin123`).
- **Gate Pass Form** – Fill the digital form (date, authorized person, purpose, vehicle, items table). On submit, a gate pass is saved and a **barcode** (Code 128) is generated containing the GP number for use with barcode scanner devices.
- **Scan Barcode** – Scan the gate pass barcode with a barcode scanner (or enter the GP number) to look up and display the encoded gate pass data (company/gate side).
- **User Encoding** – Create and edit users (username, password, full name, role).
- **Product Encoding** – Manage item codes and descriptions used in gate pass line items.

## Prerequisites

- Node.js 18+
- Python 3.10+
- MySQL server

## Setup

### 1. MySQL

Create a database and user:

```sql
CREATE DATABASE gate_pass_db;
-- Optionally create a user and grant privileges.
```

### 2. Backend (Python)

```bash
cd backend
cp .env.example .env
# Edit .env and set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tables and a default admin user are created on first run.

### 3. Frontend (React)

```bash
cd frontend
npm install
# Optional: create .env with VITE_API_URL=http://localhost:8000 if API is elsewhere
npm run dev
```

Open **http://localhost:5173**. Log in with `admin` / `admin123`, then use Gate Pass Form, Scan, User Encoding, and Product Encoding from the nav.

## API

- **POST /auth/login** – Login (returns JWT and user).
- **GET/POST/PUT/DELETE /users** – User CRUD (auth required).
- **GET/POST/PUT/DELETE /products** – Product CRUD (auth required).
- **GET/POST /gate-passes** – List and create gate passes (auth required).
- **GET /gate-passes/by-number/{gp_number}** – Look up by GP number (no auth; for scanning).

Barcodes encode the **gate pass number**; the scan page calls the API with that number to show the full gate pass data.
