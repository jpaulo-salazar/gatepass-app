from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.routes.auth import verify_token, hash_password
router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"scan_only", "encoding", "admin"}

def _normalize_role(role: str) -> str:
    """Treat legacy 'user' and 'gatepass_only' as encoding."""
    if role in ("user", "gatepass_only"):
        return "encoding"
    return role or "encoding"

def get_current_user(authorization: str = Header(None, alias="Authorization")):
    """Returns (user_id_str, role). Role is one of scan_only, encoding, admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(authorization.split(" ")[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    uid = payload.get("sub")
    role = _normalize_role(payload.get("role") or "")
    if not role or role not in VALID_ROLES:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT role FROM users WHERE id = %s", (uid,))
                row = cur.fetchone()
                role = _normalize_role(row["role"] if row else "encoding")
    return uid, role

def get_current_user_id(authorization: str = Header(None, alias="Authorization")):
    uid, _ = get_current_user(authorization)
    return uid

def role_required(*allowed_roles: str):
    def dep(authorization: str = Header(None, alias="Authorization")):
        _, role = get_current_user(authorization)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not allowed for your role")
    return dep

@router.get("", response_model=list[UserResponse])
def list_users(authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, full_name, role FROM users ORDER BY id")
            rows = cur.fetchall()
    return [UserResponse(id=r["id"], username=r["username"], full_name=r["full_name"], role=r["role"]) for r in rows]

@router.post("", response_model=UserResponse)
def create_user(user: UserCreate, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    get_current_user_id(authorization)
    role = user.role if user.role in VALID_ROLES else "encoding"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s", (user.username,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Username already exists")
            cur.execute(
                "INSERT INTO users (username, password_hash, full_name, role) VALUES (%s, %s, %s, %s)",
                (user.username, hash_password(user.password), user.full_name or "", role)
            )
            cur.execute("SELECT id, username, full_name, role FROM users WHERE id = LAST_INSERT_ID()")
            row = cur.fetchone()
    return UserResponse(id=row["id"], username=row["username"], full_name=row["full_name"], role=row["role"] or role)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            role = user.role if user.role in VALID_ROLES else "encoding"
            if user.password:
                cur.execute(
                    "UPDATE users SET username=%s, password_hash=%s, full_name=%s, role=%s WHERE id=%s",
                    (user.username, hash_password(user.password), user.full_name or "", role, user_id)
                )
            else:
                cur.execute(
                    "UPDATE users SET username=%s, full_name=%s, role=%s WHERE id=%s",
                    (user.username, user.full_name or "", role, user_id)
                )
            cur.execute("SELECT id, username, full_name, role FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
    return UserResponse(id=row["id"], username=row["username"], full_name=row["full_name"], role=row["role"])

@router.delete("/{user_id}")
def delete_user(user_id: int, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}
