"""
Create Transmittal admin user (username: admin, password: admin).
Run from backend directory with venv activated:
  venv\\Scripts\\activate   (Windows)
  source venv/bin/activate  (Linux/Mac)
  python scripts/create_transmittal_admin.py
Idempotent: re-run to reset password to 'admin' if the user already exists.
"""
import sys
from pathlib import Path

# Allow importing app when run as scripts/create_transmittal_admin.py
backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from app.database import get_db
from app.routes.auth import hash_password


def main():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (username, password_hash, full_name, role, `system`)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    password_hash = VALUES(password_hash),
                    full_name = VALUES(full_name),
                    role = VALUES(role)
                """,
                ("admin", hash_password("admin"), "Transmittal Admin", "admin", "transmittal"),
            )
    print("Transmittal admin created/updated: username=admin, password=admin")


if __name__ == "__main__":
    main()
