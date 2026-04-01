from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.routes.auth import verify_token, hash_password

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {"scan_only", "encoding", "admin", "employee"}
SYSTEMS = ("gatepass", "transmittal")


def _validate_role_for_system(role: str, system: str) -> str:
    if role not in VALID_ROLES:
        return "encoding"
    if role == "employee" and system != "transmittal":
        raise HTTPException(400, detail="Employee role is only valid for Transmittal system users")
    return role


def _normalize_role(role: str) -> str:
    if role in ("user", "gatepass_only"):
        return "encoding"
    return role or "encoding"


def get_current_user(authorization: str = Header(None, alias="Authorization")):
    """Returns (user_id_str, system, role). system is 'gatepass' or 'transmittal'."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(authorization.split(" ")[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    uid = payload.get("sub")
    system = (payload.get("system") or "gatepass").strip().lower()
    if system not in SYSTEMS:
        system = "gatepass"
    role = _normalize_role(payload.get("role") or "")
    if not role or role not in VALID_ROLES:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT role FROM users WHERE id = %s", (uid,))
                row = cur.fetchone()
                role = _normalize_role(row["role"] if row else "encoding")
    return uid, system, role


def get_current_user_id(authorization: str = Header(None, alias="Authorization")):
    uid, _, _ = get_current_user(authorization)
    return uid


def require_system(*allowed_systems: str):
    """Dependency: require JWT system to be one of allowed_systems."""
    def dep(authorization: str = Header(None, alias="Authorization")):
        _, system, _ = get_current_user(authorization)
        if system not in allowed_systems:
            raise HTTPException(status_code=403, detail="Not allowed for this system")
    return dep


def role_required(*allowed_roles: str):
    def dep(authorization: str = Header(None, alias="Authorization")):
        _, _, role = get_current_user(authorization)
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not allowed for your role")
    return dep


def user_is_transmittal_reception_desk(user_id: int) -> bool:
    """True if user is transmittal and their department has is_reception_desk."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT COALESCE(d.is_reception_desk, 0) AS v
                   FROM users u
                   LEFT JOIN departments d ON u.department_id = d.id
                   WHERE u.id = %s AND u.`system` = 'transmittal'""",
                (user_id,),
            )
            row = cur.fetchone()
    return bool(row and int(row.get("v") or 0))


@router.get("", response_model=list[UserResponse])
def list_users(
    authorization: str = Header(None, alias="Authorization"),
):
    uid, system, role = get_current_user(authorization)
    if role not in ("encoding", "admin", "scan_only", "employee"):
        raise HTTPException(status_code=403, detail="Not allowed for your role")
    if role in ("scan_only", "employee"):
        if system != "transmittal" or not user_is_transmittal_reception_desk(int(uid)):
            raise HTTPException(status_code=403, detail="Not allowed for your role")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT u.id, u.username, u.full_name, u.department_id, d.name AS department,
                          COALESCE(d.is_reception_desk, 0) AS department_is_reception_desk, u.role, u.\x60system\x60
                   FROM users u
                   LEFT JOIN departments d ON u.department_id = d.id
                   WHERE u.\x60system\x60 = %s ORDER BY u.id""",
                (system,),
            )
            rows = cur.fetchall()
    return [
        UserResponse(
            id=r["id"],
            username=r["username"],
            full_name=r["full_name"],
            department_id=r.get("department_id"),
            department=r.get("department"),
            department_is_reception_desk=bool(r.get("department_is_reception_desk")),
            role=r["role"] or "encoding",
            system=r.get("system") or system,
        )
        for r in rows
    ]


@router.post("", response_model=UserResponse)
def create_user(user: UserCreate, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    _, system, _ = get_current_user(authorization)
    role = _validate_role_for_system(user.role if user.role in VALID_ROLES else "encoding", system)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s AND \x60system\x60 = %s", (user.username, system))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Username already exists in this system")
            dept_id = user.department_id
            if dept_id:
                cur.execute("SELECT id FROM departments WHERE id = %s AND \x60system\x60 = %s", (dept_id, system))
                if not cur.fetchone():
                    raise HTTPException(status_code=400, detail="Invalid department")
            cur.execute(
                "INSERT INTO users (username, password_hash, full_name, department_id, role, \x60system\x60) VALUES (%s, %s, %s, %s, %s, %s)",
                (user.username, hash_password(user.password), user.full_name or "", dept_id, role, system),
            )
            cur.execute(
                """SELECT u.id, u.username, u.full_name, u.department_id, d.name AS department,
                          COALESCE(d.is_reception_desk, 0) AS department_is_reception_desk, u.role, u.\x60system\x60
                   FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = LAST_INSERT_ID()"""
            )
            row = cur.fetchone()
    return UserResponse(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        department_id=row.get("department_id"),
        department=row.get("department"),
        department_is_reception_desk=bool(row.get("department_is_reception_desk")),
        role=row["role"] or role,
        system=row.get("system") or system,
    )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user: UserUpdate, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    _, system, _ = get_current_user(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE id = %s AND \x60system\x60 = %s", (user_id, system))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            role = _validate_role_for_system(user.role if user.role in VALID_ROLES else "encoding", system)
            dept_id = user.department_id
            if dept_id:
                cur.execute("SELECT id FROM departments WHERE id = %s AND \x60system\x60 = %s", (dept_id, system))
                if not cur.fetchone():
                    raise HTTPException(status_code=400, detail="Invalid department")
            if user.password:
                cur.execute(
                    "UPDATE users SET username=%s, password_hash=%s, full_name=%s, department_id=%s, role=%s WHERE id=%s AND \x60system\x60=%s",
                    (user.username, hash_password(user.password), user.full_name or "", dept_id, role, user_id, system),
                )
            else:
                cur.execute(
                    "UPDATE users SET username=%s, full_name=%s, department_id=%s, role=%s WHERE id=%s AND \x60system\x60=%s",
                    (user.username, user.full_name or "", dept_id, role, user_id, system),
                )
            cur.execute(
                """SELECT u.id, u.username, u.full_name, u.department_id, d.name AS department,
                          COALESCE(d.is_reception_desk, 0) AS department_is_reception_desk, u.role, u.\x60system\x60
                   FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
    return UserResponse(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        department_id=row.get("department_id"),
        department=row.get("department"),
        department_is_reception_desk=bool(row.get("department_is_reception_desk")),
        role=row["role"],
        system=row.get("system") or system,
    )


@router.delete("/{user_id}")
def delete_user(user_id: int, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    _, system, _ = get_current_user(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s AND \x60system\x60 = %s", (user_id, system))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}
