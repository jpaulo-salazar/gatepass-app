# Gate Pass App – Installation Instructions

Follow these steps to run the Gate Pass app on your local machine (backend + frontend + MySQL).

---

## Handoff: Giving this project for local testing

If you’re **sending the project** so someone else can run it on their PC:

1. **What to send**
   - Zip the whole project folder (e.g. `gate-pass-app`), **or** share via Git (clone/pull).
   - **Do not include** (they will recreate these locally):
     - `backend/.env` (contains your DB password – they create their own from `.env.example`)
     - `backend/venv/` (Python virtual environment)
     - `frontend/node_modules/` (npm will install)
     - `backend/app/**/__pycache__/` (Python cache)

2. **What to tell them**
   - “Install MySQL, Python 3.10+, and Node.js 18+.”
   - “Open **INSTALL.md** and follow it step by step.”
   - Default login after setup: **admin** / **admin123**.

3. **If you use Git**
   - Ensure `.gitignore` includes: `.env`, `venv/`, `node_modules/`, `__pycache__/`.
   - They can then: `git clone <repo>` and follow **INSTALL.md**.

---

## What you need installed

| Software    | Version  | Purpose                    |
|------------|----------|----------------------------|
| **MySQL**  | 5.7+ or 8.x | Database                  |
| **Python** | 3.10+    | Backend API (FastAPI)      |
| **Node.js**| 18+      | Frontend (React / Vite)    |

If any of these are missing, install them first (see below).

---

## Step 1: Install MySQL

### Option A – MySQL Installer (Windows)

1. Go to: https://dev.mysql.com/downloads/installer/
2. Download **MySQL Installer for Windows** (e.g. the larger “mysql-installer-community”).
3. Run the installer and install at least **MySQL Server**.
4. During setup you can set a **root password** (remember it for Step 2).
5. Ensure the MySQL **service** is running (e.g. Services → MySQL, or from MySQL Installer).

### Option B – XAMPP (includes MySQL)

1. Download: https://www.apachefriends.org/download.html  
2. Install XAMPP, then open **XAMPP Control Panel** and click **Start** next to **MySQL**.

### Option C – Other (macOS / Linux)

- **macOS:** `brew install mysql` then `brew services start mysql`
- **Linux:** Use your package manager (e.g. `apt install mysql-server`).

---

## Step 2: Create the database

1. Open a MySQL client (e.g. **HeidiSQL**, **MySQL Workbench**, or command line).
2. Connect with user **root** and the password you set (if any).
3. Create the database and tables by running the project’s SQL script:

**Using the project script (recommended):**

- In HeidiSQL: **File → Run SQL file** → choose `backend/init_db.sql`.
- Or from command line (from the project root):

  ```bash
  mysql -u root -p < backend/init_db.sql
  ```

  (Enter your MySQL root password when asked. Leave `-p` out if root has no password.)

This creates the database `gate_pass_db` and the tables.

- **If you already have the database** and are adding the new **Item Group** column to products: run `backend/migrations/001_add_products_item_group.sql` (e.g. in HeidiSQL).
- **Optional:** To load example products (Item No., Description, Item Group), run `backend/seed_products.sql` after `init_db.sql`. Edit that file to add your full product list.

---

## Step 3: Backend (Python API)

### 3.1 Open a terminal in the project folder

Example (Windows PowerShell):

```powershell
cd C:\path\to\gate-pass-app
```

(Use the real path where you extracted/copied the project.)

### 3.2 Go to the backend folder and create `.env`

```powershell
cd backend
```

Create a file named **`.env`** in the `backend` folder (copy from `.env.example` if it exists). It should contain:

```env
MYSQL_HOST=127.0.0.1
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password_here
MYSQL_DATABASE=gate_pass_db
```

- Replace **`your_mysql_password_here`** with your actual MySQL root password.  
- If MySQL root has **no password**, use: `MYSQL_PASSWORD=` (leave it empty).

### 3.3 Create a Python virtual environment and install dependencies

**Windows (PowerShell):**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If `python` is not found, try:

```powershell
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Linux / macOS:**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3.4 Start the backend server

With the virtual environment still activated:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

For **LAN access** (using the app at `http://<this-pc-ip>:5173`), use **`--host 0.0.0.0`** so the API accepts connections on your network IP:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see something like: **Uvicorn running on http://127.0.0.1:8000** (or **http://0.0.0.0:8000** when using `--host 0.0.0.0`).  
Leave this terminal open. The API will create tables and a default admin user on first run if they don’t exist.

---

## Step 4: Frontend (React app)

### 4.1 Open a **new** terminal (keep the backend running in the first one)

Go to the project root, then into the frontend folder:

```powershell
cd C:\path\to\gate-pass-app
cd frontend
```

### 4.2 Install dependencies and start the dev server

```powershell
npm install
npm run dev
```

You should see the dev server running, e.g. **http://localhost:5173**.

### 4.3 Optional: point frontend to a different API URL

If the API is not at `http://localhost:8000`, create a file **`frontend/.env`** with:

```env
VITE_API_URL=http://localhost:8000
```

(Change the URL if your backend runs elsewhere.)

---

## Step 5: Use the app

1. In your browser, open: **http://localhost:5173**
2. Log in with:
   - **Username:** `admin`  
   - **Password:** `admin123`
3. You can then use:
   - **Gate Pass Form** – create gate passes and print barcodes  
   - **Scan Barcode** – scan or enter GP number to view details  
   - **User Encoding** – manage users  
   - **Product Encoding** – manage products  

---

## Let other computers on your network access the app (LAN)

To run the app on **one computer** and open it from **other devices** on the same network (e.g. other PCs, tablets, phones):

### 1. Find this computer’s IP address

- **Windows:** Open Command Prompt or PowerShell and run `ipconfig`. Look for **IPv4 Address** under your active adapter (e.g. **192.168.1.100**).
- **macOS / Linux:** Run `ifconfig` or `ip addr` and use the address for your LAN interface (often `192.168.x.x` or `10.x.x.x`).

Use that IP in the steps below (example: **192.168.1.100**).

### 2. Start the backend so it accepts connections from other machines

In the **backend** folder, with your venv activated, run:

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` makes the API listen on all network interfaces, not only localhost.

### 3. Allow the frontend origin in CORS

In **backend**, create or edit **`.env`** and add (use your real IP):

```env
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.100:5173
```

Replace **192.168.1.100** with the IP from step 1. Restart the backend after changing `.env`.

### 4. Start the frontend so others can reach it

In the **frontend** folder:

```powershell
npm run dev -- --host
```

That runs Vite with `--host` so the dev server is reachable at `http://<this-pc-ip>:5173`.

### 5. Point the frontend to this computer’s API URL

Create or edit **frontend/.env** and set the API to this computer’s IP and port:

```env
VITE_API_URL=http://192.168.1.100:8000
```

Again, use the IP from step 1. Restart the frontend dev server (`npm run dev -- --host`) after changing this.

### 6. Open the app from other computers

On **another device** on the same network, open a browser and go to:

**http://192.168.1.100:5173**

(Use the same IP you used above.) Log in with **admin** / **admin123** (or your own user).

### Summary

| Where        | What to do |
|-------------|------------|
| **This PC** | Run backend with `--host 0.0.0.0`, run frontend with `npm run dev -- --host`, set `VITE_API_URL` and `BACKEND_CORS_ORIGINS` to this PC’s IP. |
| **Other PCs** | In the browser, open `http://<this-pc-ip>:5173`. |

**Firewall:** If others cannot connect, allow inbound traffic on **port 8000** (API) and **5173** (frontend) in Windows Firewall (or your firewall) for the local network.

---

## Quick reference – run order

1. **MySQL** – installed and running; database `gate_pass_db` created (e.g. via `backend/init_db.sql`).
2. **Backend** – in `backend`: `.env` set → `venv` activated → `pip install -r requirements.txt` → `python -m uvicorn app.main:app --reload --port 8000`.
3. **Frontend** – in `frontend`: `npm install` → `npm run dev`.
4. **Browser** – open http://localhost:5173 and log in with `admin` / `admin123`.

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| **“Python was not found”** | Install Python from python.org and check “Add Python to PATH”, or use `py` instead of `python` on Windows. |
| **“No module named uvicorn”** | Activate the venv (`.\venv\Scripts\Activate.ps1`) and run `pip install -r requirements.txt` again. |
| **“Access denied for user 'root'@'localhost'”** | Check `backend/.env`: correct `MYSQL_PASSWORD` for your MySQL root user. |
| **“Can't connect to server on '127.0.0.1'”** | MySQL is not running. Start the MySQL service (e.g. XAMPP, Services, or `brew services start mysql`). |
| **Frontend can’t reach API** | Ensure the backend is running on port 8000. If needed, set `VITE_API_URL` in `frontend/.env`. |
| **“password cannot be longer than 72 bytes”** | Should be fixed in current code; ensure you use the latest backend and `bcrypt` (not only passlib). |

If you hit an error not listed here, check the exact message in the terminal (backend or frontend) and in the browser console (F12).

---

## Deploying to a server (optional)

When you want to run the app on a real server (not just local testing):

1. **Server needs:** MySQL, Python 3.10+, Node.js 18+ (or build the frontend on your PC and upload the built files).
2. **Backend:** On the server, set `backend/.env` with the server’s MySQL host/user/password, then run with a process manager (e.g. `uvicorn app.main:app --host 0.0.0.0 --port 8000` or use gunicorn + uvicorn workers). Use HTTPS in production.
3. **Frontend:** Run `npm run build` in `frontend/`, then serve the `frontend/dist/` folder with any web server (Nginx, Apache, or the same server). Set `VITE_API_URL` to your backend URL (e.g. `https://api.yourdomain.com`) before building.
4. **CORS:** In `backend/app/main.py`, add your frontend URL (e.g. `https://yourdomain.com`) to `allow_origins` in the CORS middleware.
5. **Security:** Change the default admin password, use a strong `SECRET_KEY` for JWT (in `backend/app/routes/auth.py`), and keep `.env` out of version control.
