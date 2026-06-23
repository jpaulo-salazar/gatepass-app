from datetime import datetime, date as date_type
from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.document_series import KIND_TRANSMITTAL, allocate_yyyy_nnnn_number
from app.intransit import EVENT_RELEASE_BARCODE_SCAN, normalize_intransit
from app.schemas import (
    BarcodeReleaseScanBody,
    TransmittalCreate,
    TransmittalUpdate,
    TransmittalResponse,
    TransmittalItemResponse,
    TransmittalStatusUpdate,
    TransmittalReceiveUpdate,
    TransmittalScanEventResponse,
    TransmittalOutBarcodeScanBody,
)
from app.routes.users import get_current_user_id, require_system, get_current_user, role_required
from app.routes.auth import verify_token

router = APIRouter(prefix="/transmittals", tags=["transmittals"])

EVENT_RECEPTIONIST_BARCODE = "receptionist_barcode_scanned"
EVENT_RECEPTIONIST_RECEIVED = "receptionist_marked_received"
EVENT_RECIPIENT_BARCODE = "recipient_barcode_scanned"
EVENT_RECIPIENT_RECEIVED = "recipient_marked_received"
EVENT_RECEPTIONIST_OUT_SCAN = "receptionist_out_scan"
EVENT_RECIPIENT_OUT_SCAN = "recipient_out_scan"
EVENT_DROP_OFF_SCAN = "drop_off_scan"


def _out_ok_for_scan(row) -> bool:
    return (row.get("in_or_out") or "out").lower() == "out" and (row.get("status") or "").lower() == "approved"


def _dt_iso(val):
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _scan_event_from_row(r) -> TransmittalScanEventResponse:
    return TransmittalScanEventResponse(
        id=r["id"],
        event_type=r["event_type"],
        created_at=_dt_iso(r.get("created_at")) or "",
        user_id=r.get("user_id"),
        user_full_name=r.get("user_full_name"),
        intransit=r.get("intransit"),
    )


def _fetch_scan_events(cur, transmittal_id: int) -> list[TransmittalScanEventResponse]:
    cur.execute(
        """SELECT id, event_type, created_at, user_id, user_full_name, intransit
           FROM transmittal_scan_events WHERE transmittal_id = %s ORDER BY id ASC""",
        (transmittal_id,),
    )
    return [_scan_event_from_row(x) for x in cur.fetchall()]


def _insert_scan_event(
    cur,
    transmittal_id: int,
    event_type: str,
    user_id: int | None,
    user_full_name: str | None,
    intransit: str | None = None,
):
    cur.execute(
        """INSERT INTO transmittal_scan_events
           (transmittal_id, event_type, user_id, user_full_name, intransit)
           VALUES (%s, %s, %s, %s, %s)""",
        (transmittal_id, event_type, user_id, user_full_name, intransit),
    )


def _auth_user_row(authorization: str) -> tuple[int, str | None]:
    uid_str = get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name FROM users WHERE id = %s", (uid_str,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    fn = row.get("full_name")
    fn = (fn or "").strip() or None
    return int(row["id"]), fn


def _optional_transmittal_actor(authorization: str | None) -> tuple[int, str | None] | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    payload = verify_token(authorization.split(" ", 1)[1])
    if not payload:
        return None
    if (payload.get("system") or "gatepass").strip().lower() != "transmittal":
        return None
    uid = payload.get("sub")
    if uid is None:
        return None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name FROM users WHERE id = %s", (uid,))
            row = cur.fetchone()
    if not row:
        return None
    fn = row.get("full_name")
    fn = (fn or "").strip() or None
    return int(row["id"]), fn


def _row_to_response(row, items_rows, scan_events: list[TransmittalScanEventResponse] | None = None):
    if scan_events is None:
        scan_events = []
    return TransmittalResponse(
        id=row["id"],
        transmittal_number=row["transmittal_number"],
        transmittal_date=row["transmittal_date"],
        recipient_name=row["recipient_name"],
        recipient_department_id=row.get("recipient_department_id"),
        in_or_out=row.get("in_or_out") or "out",
        purpose_return=bool(row["purpose_return"]),
        purpose_inter_warehouse=bool(row["purpose_inter_warehouse"]),
        purpose_others=bool(row["purpose_others"]),
        vehicle_type=row["vehicle_type"],
        plate_no=row["plate_no"],
        truck_seal_no=row.get("truck_seal_no"),
        prepared_by=row["prepared_by"],
        checked_by=row["checked_by"],
        recommended_by=row["recommended_by"],
        approved_by=row["approved_by"],
        time_out=row["time_out"],
        time_in=row["time_in"],
        status=row.get("status"),
        rejected_remarks=row.get("rejected_remarks"),
        date_approved=row.get("date_approved"),
        received_by_receptionist_at=_dt_iso(row.get("received_by_receptionist_at")),
        received_by_receptionist_name=row.get("received_by_receptionist_name"),
        recipient_department=row.get("recipient_department"),
        recipient_user_id=row.get("recipient_user_id"),
        recipient_user_name=row.get("recipient_user_name"),
        received_by_recipient_at=_dt_iso(row.get("received_by_recipient_at")),
        received_by_recipient_name=row.get("received_by_recipient_name"),
        items=[
            TransmittalItemResponse(
                id=r["id"],
                item_description=r["item_description"],
                qty=r["qty"],
                ref_doc_no=r["ref_doc_no"],
                destination=r["destination"],
            )
            for r in items_rows
        ],
        scan_events=scan_events,
    )


def _response_from_id(cur, transmittal_id: int, with_events: bool) -> TransmittalResponse:
    cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Transmittal not found")
    cur.execute("SELECT * FROM transmittal_items WHERE transmittal_id = %s ORDER BY id", (transmittal_id,))
    items = cur.fetchall()
    ev = _fetch_scan_events(cur, transmittal_id) if with_events else []
    return _row_to_response(row, items, ev)


@router.get("", response_model=list[TransmittalResponse])
def list_transmittals(
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals ORDER BY id DESC")
            rows = cur.fetchall()
            result = []
            for r in rows:
                cur.execute("SELECT * FROM transmittal_items WHERE transmittal_id = %s ORDER BY id", (r["id"],))
                items = cur.fetchall()
                ev = _fetch_scan_events(cur, r["id"])
                result.append(_row_to_response(r, items, ev))
    return result


@router.get("/my-upcoming", response_model=list[TransmittalResponse])
def list_my_upcoming_transmittals(
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("employee")),
):
    """Approved transmittals assigned to the logged-in employee recipient, not yet received by recipient."""
    uid = int(get_current_user_id(authorization))
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT * FROM transmittals
                   WHERE recipient_user_id = %s
                     AND LOWER(COALESCE(status,'')) = 'approved'
                     AND received_by_recipient_at IS NULL
                   ORDER BY transmittal_date DESC, id DESC""",
                (uid,),
            )
            rows = cur.fetchall()
            result = []
            for r in rows:
                cur.execute("SELECT * FROM transmittal_items WHERE transmittal_id = %s ORDER BY id", (r["id"],))
                items = cur.fetchall()
                result.append(_row_to_response(r, items))
    return result


@router.get("/by-number/{transmittal_number}", response_model=TransmittalResponse)
def get_by_transmittal_number(
    transmittal_number: str,
    authorization: str | None = Header(None, alias="Authorization"),
):
    """Look up by transmittal number (barcode). No auth required; if Bearer token is a Transmittal user, scan audit events are included."""
    actor = _optional_transmittal_actor(authorization)
    with_events = actor is not None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE transmittal_number = %s", (transmittal_number.strip(),))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            cur.execute("SELECT * FROM transmittal_items WHERE transmittal_id = %s ORDER BY id", (row["id"],))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, row["id"]) if with_events else []
            return _row_to_response(row, items, ev)


@router.get("/{transmittal_id}", response_model=TransmittalResponse)
def get_transmittal(
    transmittal_id: int,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            return _response_from_id(cur, transmittal_id, True)


@router.post("/{transmittal_id}/release-barcode-scan", response_model=TransmittalResponse)
def record_release_barcode_scan(
    transmittal_id: int,
    body: BarcodeReleaseScanBody,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("scan_only", "encoding", "admin")),
):
    """Guard Scan Barcode page: record release scan with Intransit destination."""
    user_id, fn = _auth_user_row(authorization)
    intransit = normalize_intransit(body.intransit)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if not _out_ok_for_scan(row):
                raise HTTPException(
                    status_code=400,
                    detail="Only approved OUT transmittals can be release-scanned.",
                )
            _insert_scan_event(cur, transmittal_id, EVENT_RELEASE_BARCODE_SCAN, user_id, fn, intransit)
            return _response_from_id(cur, transmittal_id, True)


@router.post("/{transmittal_id}/out-barcode-scan", response_model=TransmittalResponse)
def record_out_barcode_scan(
    transmittal_id: int,
    body: TransmittalOutBarcodeScanBody,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
):
    """OUT transmittal: receptionist scans first and sets recipient details, then recipient scans."""
    phase = (body.phase or "").strip().lower()
    if phase not in ("receptionist", "recipient"):
        raise HTTPException(status_code=400, detail="phase must be receptionist or recipient")
    user_id, fn = _auth_user_row(authorization)
    _, _, jwt_role = get_current_user(authorization)
    now = datetime.utcnow()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if not _out_ok_for_scan(row):
                raise HTTPException(
                    status_code=400,
                    detail="Only approved OUT transmittals can be scanned for receipt.",
                )
            if phase == "receptionist":
                if jwt_role in ("encoding", "admin"):
                    pass
                elif jwt_role in ("scan_only", "employee"):
                    cur.execute(
                        """SELECT COALESCE(d.is_reception_desk, 0) AS v
                           FROM users u
                           LEFT JOIN departments d ON u.department_id = d.id
                           WHERE u.id = %s AND u.`system` = 'transmittal'""",
                        (user_id,),
                    )
                    rdesk = cur.fetchone()
                    if not rdesk or not int(rdesk.get("v") or 0):
                        raise HTTPException(
                            status_code=403,
                            detail="Only users in a reception desk department can complete the receptionist step.",
                        )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="Only encoding, admin, or reception-desk scan/employee users can complete the receptionist step.",
                    )
                if row.get("received_by_receptionist_at"):
                    raise HTTPException(
                        status_code=400,
                        detail="Receptionist step is already done. Recipient should scan the barcode next.",
                    )
                # Pre-assigned recipient on transmittal form — confirm intake only (no dropdown data required).
                if row.get("recipient_user_id"):
                    _insert_scan_event(cur, transmittal_id, EVENT_RECEPTIONIST_OUT_SCAN, user_id, fn)
                    cur.execute(
                        """UPDATE transmittals SET received_by_receptionist_at = %s,
                           received_by_receptionist_name = COALESCE(%s, received_by_receptionist_name)
                           WHERE id = %s""",
                        (now, fn, transmittal_id),
                    )
                else:
                    recipient_department_id = body.recipient_department_id
                    recipient_user_id = body.recipient_user_id
                    if not recipient_user_id:
                        raise HTTPException(status_code=400, detail="recipient_user_id is required")
                    recipient_department = None
                    if recipient_department_id:
                        cur.execute(
                            "SELECT id, name FROM departments WHERE id = %s AND `system` = 'transmittal'",
                            (recipient_department_id,),
                        )
                        drow = cur.fetchone()
                        if not drow:
                            raise HTTPException(status_code=400, detail="Invalid recipient_department_id")
                        recipient_department = drow["name"]
                    else:
                        recipient_department = (body.recipient_department or "").strip() or None
                        if not recipient_department:
                            raise HTTPException(
                                status_code=400,
                                detail="recipient_department_id (or legacy recipient_department) is required",
                            )
                    cur.execute(
                        "SELECT id, full_name, department_id FROM users WHERE id = %s AND `system` = 'transmittal'",
                        (recipient_user_id,),
                    )
                    recipient_user = cur.fetchone()
                    if not recipient_user:
                        raise HTTPException(status_code=400, detail="Selected recipient user does not exist")
                    if recipient_department_id:
                        rdept = recipient_user.get("department_id")
                        if rdept is None or int(rdept) != int(recipient_department_id):
                            raise HTTPException(status_code=400, detail="Selected user is not in the chosen department")
                    recipient_user_name = (recipient_user.get("full_name") or "").strip() or None
                    _insert_scan_event(cur, transmittal_id, EVENT_RECEPTIONIST_OUT_SCAN, user_id, fn)
                    cur.execute(
                        """UPDATE transmittals SET received_by_receptionist_at = %s,
                           received_by_receptionist_name = COALESCE(%s, received_by_receptionist_name),
                           recipient_department = %s,
                           recipient_user_id = %s,
                           recipient_user_name = %s
                           WHERE id = %s""",
                        (now, fn, recipient_department, recipient_user_id, recipient_user_name, transmittal_id),
                    )
            else:
                if jwt_role in ("encoding", "admin", "employee"):
                    pass
                elif jwt_role == "scan_only":
                    cur.execute(
                        """SELECT COALESCE(d.is_reception_desk, 0) AS v
                           FROM users u
                           LEFT JOIN departments d ON u.department_id = d.id
                           WHERE u.id = %s AND u.`system` = 'transmittal'""",
                        (user_id,),
                    )
                    rdesk = cur.fetchone()
                    if not rdesk or not int(rdesk.get("v") or 0):
                        raise HTTPException(
                            status_code=403,
                            detail="Only encoding, admin, employee, or reception-desk scan users can complete the recipient step.",
                        )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="Only encoding, admin, employee, or reception-desk scan users can complete the recipient step.",
                    )
                if not row.get("received_by_receptionist_at"):
                    raise HTTPException(
                        status_code=400,
                        detail="Receptionist must scan first.",
                    )
                if row.get("received_by_recipient_at"):
                    raise HTTPException(status_code=400, detail="This transmittal is already fully received")
                selected_recipient_user_id = row.get("recipient_user_id")
                if selected_recipient_user_id and int(selected_recipient_user_id) != int(user_id):
                    raise HTTPException(
                        status_code=403,
                        detail="Only the assigned recipient user can complete this step.",
                    )
                _insert_scan_event(cur, transmittal_id, EVENT_RECIPIENT_OUT_SCAN, user_id, fn)
                cur.execute(
                    """UPDATE transmittals SET received_by_recipient_at = %s,
                       received_by_recipient_name = COALESCE(%s, received_by_recipient_name) WHERE id = %s""",
                    (now, fn, transmittal_id),
                )
            return _response_from_id(cur, transmittal_id, True)


@router.post("/{transmittal_id}/in-barcode-scan", response_model=TransmittalResponse)
def record_in_barcode_scan_compat(
    transmittal_id: int,
    body: TransmittalOutBarcodeScanBody,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
):
    """Backward compatibility alias: old path now routes to OUT scan flow."""
    return record_out_barcode_scan(transmittal_id, body, authorization, _)


@router.post("/{transmittal_id}/drop-off-scan", response_model=TransmittalResponse)
def record_drop_off_scan(
    transmittal_id: int,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin", "drop_off")),
):
    """Optional drop-off marker before the required receptionist step."""
    user_id, fn = _auth_user_row(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if not _out_ok_for_scan(row):
                raise HTTPException(
                    status_code=400,
                    detail="Only approved OUT transmittals can be marked as drop off.",
                )
            if row.get("received_by_receptionist_at"):
                raise HTTPException(
                    status_code=400,
                    detail="Receptionist step is already done; drop off is no longer needed.",
                )
            cur.execute(
                """SELECT id FROM transmittal_scan_events
                   WHERE transmittal_id = %s AND event_type = %s
                   ORDER BY id DESC LIMIT 1""",
                (transmittal_id, EVENT_DROP_OFF_SCAN),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Drop off has already been recorded for this transmittal.")
            _insert_scan_event(cur, transmittal_id, EVENT_DROP_OFF_SCAN, user_id, fn)
            return _response_from_id(cur, transmittal_id, True)


@router.patch("/{transmittal_id}/status", response_model=TransmittalResponse)
def update_transmittal_status(
    transmittal_id: int,
    body: TransmittalStatusUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    get_current_user_id(authorization)
    status = (body.status or "").strip().lower() or None
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be pending, approved, or rejected")
    rejected_remarks = body.rejected_remarks if status == "rejected" else None
    approved_by = (body.approved_by or "").strip() or None if status == "approved" else None
    date_approved = date_type.today() if status == "approved" else None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM transmittals WHERE id = %s", (transmittal_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if status == "approved":
                cur.execute(
                    """UPDATE transmittals SET status = %s, rejected_remarks = NULL,
                       approved_by = COALESCE(%s, approved_by), date_approved = %s WHERE id = %s""",
                    (status, approved_by, date_approved, transmittal_id),
                )
            else:
                cur.execute(
                    "UPDATE transmittals SET status = %s, rejected_remarks = %s WHERE id = %s",
                    (status, rejected_remarks, transmittal_id),
                )
            return _response_from_id(cur, transmittal_id, False)


@router.patch("/{transmittal_id}/receive-receptionist", response_model=TransmittalResponse)
def receive_receptionist(
    transmittal_id: int,
    body: TransmittalReceiveUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin")),
):
    """Receptionist confirms receipt; sets received_by_receptionist_at and optional name."""
    user_id, default_name = _auth_user_row(authorization)
    now = datetime.utcnow()
    name = (body.received_by or "").strip() or default_name
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            in_out = (row.get("in_or_out") or "out").lower()
            if in_out != "out":
                raise HTTPException(status_code=400, detail="Only OUT transmittals use receptionist receipt")
            if not _out_ok_for_scan(row):
                raise HTTPException(status_code=400, detail="Transmittal is not approved for this action")
            if row.get("received_by_receptionist_at"):
                raise HTTPException(status_code=400, detail="Receptionist receipt already recorded")
            _insert_scan_event(cur, transmittal_id, EVENT_RECEPTIONIST_RECEIVED, user_id, name)
            cur.execute(
                """UPDATE transmittals SET received_by_receptionist_at = %s, received_by_receptionist_name = COALESCE(%s, received_by_receptionist_name)
                   WHERE id = %s""",
                (now, name, transmittal_id),
            )
            return _response_from_id(cur, transmittal_id, True)


@router.patch("/{transmittal_id}/receive-recipient", response_model=TransmittalResponse)
def receive_recipient(
    transmittal_id: int,
    body: TransmittalReceiveUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin", "employee")),
):
    """Recipient confirms receipt; sets received_by_recipient_at and optional name."""
    user_id, default_name = _auth_user_row(authorization)
    now = datetime.utcnow()
    name = (body.received_by or "").strip() or default_name
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            in_out = (row.get("in_or_out") or "out").lower()
            if in_out != "out":
                raise HTTPException(status_code=400, detail="Only OUT transmittals use recipient receipt")
            if not _out_ok_for_scan(row):
                raise HTTPException(status_code=400, detail="Transmittal is not approved for this action")
            if not row.get("received_by_receptionist_at"):
                raise HTTPException(
                    status_code=400,
                    detail="Receptionist must scan the barcode and confirm receipt first",
                )
            if row.get("received_by_recipient_at"):
                raise HTTPException(status_code=400, detail="Recipient receipt already recorded")
            selected_recipient_user_id = row.get("recipient_user_id")
            if selected_recipient_user_id and int(selected_recipient_user_id) != int(user_id):
                raise HTTPException(
                    status_code=403,
                    detail="Only the assigned recipient user can complete this step.",
                )
            _insert_scan_event(cur, transmittal_id, EVENT_RECIPIENT_RECEIVED, user_id, name)
            cur.execute(
                """UPDATE transmittals SET received_by_recipient_at = %s, received_by_recipient_name = COALESCE(%s, received_by_recipient_name)
                   WHERE id = %s""",
                (now, name, transmittal_id),
            )
            return _response_from_id(cur, transmittal_id, True)


@router.post("/clear-history")
def clear_transmittal_history(
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("admin")),
):
    """Remove all transmittals, line items, and scan events. Transmittal numbers (YYYYNNNN) continue from the stored counter."""
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM transmittals")
            n = int(cur.fetchone()["c"])
            cur.execute("DELETE FROM transmittals")
    return {
        "deleted": n,
        "message": "All transmittals removed. New transmittals will use the next sequence number (not reset to 0001).",
    }


@router.post("", response_model=TransmittalResponse)
def create_transmittal(
    body: TransmittalCreate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT u.id, u.username, u.full_name, u.department_id, d.name AS dept_name
                   FROM users u
                   LEFT JOIN departments d ON u.department_id = d.id
                   WHERE u.id = %s AND u.`system` = 'transmittal' AND u.role = 'employee'""",
                (body.recipient_user_id,),
            )
            ru = cur.fetchone()
            if not ru:
                raise HTTPException(
                    status_code=400,
                    detail="Recipient must be a Transmittal user with role Employee (User Encoding).",
                )
            disp = (ru.get("full_name") or "").strip() or (ru.get("username") or "").strip() or str(ru["id"])
            ru_name = (ru.get("full_name") or "").strip() or None
            ru_dept_id = ru.get("department_id")
            ru_dept_name = (ru.get("dept_name") or "").strip() or None
            year = body.transmittal_date.year if hasattr(body.transmittal_date, "year") else int(str(body.transmittal_date)[:4])
            transmittal_number = allocate_yyyy_nnnn_number(cur, KIND_TRANSMITTAL, year)
            in_out = "out"
            init_status = "pending"
            init_date_approved = None
            cur.execute(
                """INSERT INTO transmittals (transmittal_number, transmittal_date, recipient_name, recipient_department_id,
                   recipient_department, recipient_user_id, recipient_user_name, in_or_out,
                   purpose_return, purpose_inter_warehouse, purpose_others,
                   vehicle_type, plate_no, truck_seal_no, prepared_by, checked_by, recommended_by, approved_by, time_out, time_in,
                   status, date_approved)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    transmittal_number,
                    body.transmittal_date,
                    disp,
                    ru_dept_id,
                    ru_dept_name,
                    body.recipient_user_id,
                    ru_name,
                    in_out,
                    int(body.purpose_return),
                    int(body.purpose_inter_warehouse),
                    int(body.purpose_others),
                    body.vehicle_type,
                    body.plate_no,
                    body.truck_seal_no,
                    body.prepared_by,
                    body.checked_by,
                    body.recommended_by,
                    body.approved_by,
                    body.time_out,
                    body.time_in,
                    init_status,
                    init_date_approved,
                ),
            )
            transmittal_id = cur.lastrowid
            for it in body.items:
                cur.execute(
                    """INSERT INTO transmittal_items (transmittal_id, item_description, qty, ref_doc_no, destination)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (transmittal_id, it.item_description, it.qty, it.ref_doc_no, it.destination),
                )
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            cur.execute("SELECT * FROM transmittal_items WHERE transmittal_id = %s ORDER BY id", (transmittal_id,))
            items = cur.fetchall()
    return _row_to_response(row, items)


@router.put("/{transmittal_id}", response_model=TransmittalResponse)
def update_transmittal(
    transmittal_id: int,
    body: TransmittalUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
    __=Depends(role_required("encoding", "admin")),
):
    """Edit an existing transmittal. Resets status to 'pending' so it goes
    back through the admin approval cycle. Editing is only blocked once the
    recipient has confirmed receipt (the handover is complete). If the
    receptionist already received the prior version, that intake is cleared
    so the receptionist re-confirms the new approved version.
    """
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if existing.get("received_by_recipient_at"):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot edit: recipient has already received this transmittal.",
                )
            cur.execute(
                """SELECT u.id, u.username, u.full_name, u.department_id, d.name AS dept_name
                   FROM users u
                   LEFT JOIN departments d ON u.department_id = d.id
                   WHERE u.id = %s AND u.`system` = 'transmittal' AND u.role = 'employee'""",
                (body.recipient_user_id,),
            )
            ru = cur.fetchone()
            if not ru:
                raise HTTPException(
                    status_code=400,
                    detail="Recipient must be a Transmittal user with role Employee (User Encoding).",
                )
            disp = (ru.get("full_name") or "").strip() or (ru.get("username") or "").strip() or str(ru["id"])
            ru_name = (ru.get("full_name") or "").strip() or None
            ru_dept_id = ru.get("department_id")
            ru_dept_name = (ru.get("dept_name") or "").strip() or None
            cur.execute(
                """UPDATE transmittals SET
                       transmittal_date = %s,
                       recipient_name = %s,
                       recipient_department_id = %s,
                       recipient_department = %s,
                       recipient_user_id = %s,
                       recipient_user_name = %s,
                       purpose_return = %s,
                       purpose_inter_warehouse = %s,
                       purpose_others = %s,
                       vehicle_type = %s,
                       plate_no = %s,
                       truck_seal_no = %s,
                       prepared_by = %s,
                       checked_by = %s,
                       recommended_by = %s,
                       approved_by = %s,
                       time_out = %s,
                       time_in = %s,
                       status = 'pending',
                       date_approved = NULL,
                       rejected_remarks = NULL,
                       received_by_receptionist_at = NULL,
                       received_by_receptionist_name = NULL
                   WHERE id = %s""",
                (
                    body.transmittal_date,
                    disp,
                    ru_dept_id,
                    ru_dept_name,
                    body.recipient_user_id,
                    ru_name,
                    int(body.purpose_return),
                    int(body.purpose_inter_warehouse),
                    int(body.purpose_others),
                    body.vehicle_type,
                    body.plate_no,
                    body.truck_seal_no,
                    body.prepared_by,
                    body.checked_by,
                    body.recommended_by,
                    body.approved_by,
                    body.time_out,
                    body.time_in,
                    transmittal_id,
                ),
            )
            cur.execute("DELETE FROM transmittal_items WHERE transmittal_id = %s", (transmittal_id,))
            for it in body.items:
                cur.execute(
                    """INSERT INTO transmittal_items (transmittal_id, item_description, qty, ref_doc_no, destination)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (transmittal_id, it.item_description, it.qty, it.ref_doc_no, it.destination),
                )
            return _response_from_id(cur, transmittal_id, True)
