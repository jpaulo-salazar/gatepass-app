from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.schemas import DepartmentCreate, DepartmentUpdate, DepartmentResponse
from app.routes.users import get_current_user, role_required, user_is_transmittal_reception_desk

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentResponse])
def list_departments(
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
                "SELECT id, name, is_reception_desk, `system` FROM departments WHERE `system` = %s ORDER BY name",
                (system,),
            )
            rows = cur.fetchall()
    return [
        DepartmentResponse(
            id=r["id"],
            name=r["name"],
            is_reception_desk=bool(r.get("is_reception_desk")),
            system=r.get("system") or system,
        )
        for r in rows
    ]


@router.post("", response_model=DepartmentResponse)
def create_department(body: DepartmentCreate, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    _, system, _ = get_current_user(authorization)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM departments WHERE name = %s AND `system` = %s",
                (name, system),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Department name already exists for this system")
            cur.execute(
                "INSERT INTO departments (name, is_reception_desk, `system`) VALUES (%s, %s, %s)",
                (name, int(bool(body.is_reception_desk)), system),
            )
            cur.execute("SELECT id, name, is_reception_desk, `system` FROM departments WHERE id = LAST_INSERT_ID()")
            row = cur.fetchone()
    return DepartmentResponse(
        id=row["id"],
        name=row["name"],
        is_reception_desk=bool(row.get("is_reception_desk")),
        system=row.get("system") or system,
    )


@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    body: DepartmentUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(role_required("encoding", "admin")),
):
    _, system, _ = get_current_user(authorization)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM departments WHERE id = %s AND `system` = %s", (department_id, system))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Department not found")
            cur.execute(
                "SELECT id FROM departments WHERE name = %s AND `system` = %s AND id != %s",
                (name, system, department_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Another department already uses this name")
            cur.execute(
                "UPDATE departments SET name = %s, is_reception_desk = %s WHERE id = %s AND `system` = %s",
                (name, int(bool(body.is_reception_desk)), department_id, system),
            )
            cur.execute("SELECT id, name, is_reception_desk, `system` FROM departments WHERE id = %s", (department_id,))
            row = cur.fetchone()
    return DepartmentResponse(
        id=row["id"],
        name=row["name"],
        is_reception_desk=bool(row.get("is_reception_desk")),
        system=row.get("system") or system,
    )


@router.delete("/{department_id}")
def delete_department(department_id: int, authorization: str = Header(None, alias="Authorization"), _=Depends(role_required("encoding", "admin"))):
    _, system, _ = get_current_user(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM departments WHERE id = %s AND `system` = %s", (department_id, system))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Department not found")
            cur.execute("UPDATE users SET department_id = NULL WHERE department_id = %s AND `system` = %s", (department_id, system))
            cur.execute("DELETE FROM departments WHERE id = %s AND `system` = %s", (department_id, system))
    return {"ok": True}
