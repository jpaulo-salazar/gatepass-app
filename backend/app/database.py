import os
from pathlib import Path
from pymysql import connect
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

# Load .env from backend directory so it works regardless of current working directory
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

def get_connection():
    return connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DATABASE", "gate_pass_db"),
        cursorclass=DictCursor,
        autocommit=False,
    )

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Create tables if they don't exist."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255),
                    role VARCHAR(50) DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    item_code VARCHAR(100) UNIQUE NOT NULL,
                    item_description VARCHAR(500) NOT NULL,
                    item_group VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS gate_passes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    gp_number VARCHAR(50) UNIQUE NOT NULL,
                    pass_date DATE NOT NULL,
                    authorized_name VARCHAR(255) NOT NULL,
                    purpose_delivery TINYINT(1) DEFAULT 1,
                    purpose_return TINYINT(1) DEFAULT 0,
                    purpose_inter_warehouse TINYINT(1) DEFAULT 0,
                    purpose_others TINYINT(1) DEFAULT 0,
                    vehicle_type VARCHAR(100),
                    plate_no VARCHAR(50),
                    prepared_by VARCHAR(255),
                    checked_by VARCHAR(255),
                    recommended_by VARCHAR(255),
                    approved_by VARCHAR(255),
                    time_out VARCHAR(20),
                    time_in VARCHAR(20),
                    date_approved DATE NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS gate_pass_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    gate_pass_id INT NOT NULL,
                    item_code VARCHAR(100),
                    item_description VARCHAR(500) NOT NULL,
                    qty INT NOT NULL,
                    ref_doc_no VARCHAR(100),
                    destination VARCHAR(255),
                    FOREIGN KEY (gate_pass_id) REFERENCES gate_passes(id) ON DELETE CASCADE
                )
            """)
            # Default admin if no users
            cur.execute("SELECT COUNT(*) as c FROM users")
            if cur.fetchone()["c"] == 0:
                from app.routes.auth import hash_password
                cur.execute(
                    "INSERT INTO users (username, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
                    ("admin", hash_password("admin123"), "Administrator", "admin")
                )
