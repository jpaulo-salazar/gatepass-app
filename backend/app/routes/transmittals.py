from datetime import datetime, date as date_type
from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.schemas import (
    TransmittalCreate,
    TransmittalResponse,
    TransmittalItemResponse,
    TransmittalStatusUpdate,
    TransmittalReceiveUpdate,
    TransmittalScanEventResponse,
    TransmittalInBarcodeScanBody,
)
from app.routes.users import get_current_user_id, require_system
from app.routes.auth import verify_token

router = APIRouter(prefix="/transmittals", tags=["transmittals"])

EVENT_RECEPTIONIST_BARCODE = "receptionist_barcode_scanned"
EVENT_RECEPTIONIST_RECEIVED = "receptionist_marked_received"
EVENT_RECIPIENT_BARCODE = "recipient_barcode_scanned"
EVENT_RECIPIENT_RECEIVED = "recipient_marked_received"
# IN workflow (no admin approval): one logged scan per role, completes receipt in the same step
EVENT_RECEPTIONIST_IN_SCAN = "receptionist_in_scan"
EVENT_RECIPIENT_IN_SCAN = "recipient_in_scan"


def _in_ok_for_scan(row) -> bool:
    return (row.get("in_or_out") or "out").lower() == "in" and (row.get("status") or "").lower() != "rejected"


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
    )


def _fetch_scan_events(cur, transmittal_id: int) -> list[TransmittalScanEventResponse]:
    cur.execute(
        """SELECT id, event_type, created_at, user_id, user_full_name FROM transmittal_scan_events
           WHERE transmittal_id = %s ORDER BY id ASC""",
        (transmittal_id,),
    )
    return [_scan_event_from_row(x) for x in cur.fetchall()]


def _insert_scan_event(cur, transmittal_id: int, event_type: str, user_id: int | None, user_full_name: str | None):
    cur.execute(
        """INSERT INTO transmittal_scan_events (transmittal_id, event_type, user_id, user_full_name)
           VALUES (%s, %s, %s, %s)""",
        (transmittal_id, event_type, user_id, user_full_name),
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
def list_transmittals(authorization: str = Header(None, alias="Authorization"), _=Depends(require_system("transmittal"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals ORDER BY id DESC")
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
def get_transmittal(transmittal_id: int, authorization: str = Header(None, alias="Authorization"), _=Depends(require_system("transmittal"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            return _response_from_id(cur, transmittal_id, True)


@router.post("/{transmittal_id}/in-barcode-scan", response_model=TransmittalResponse)
def record_in_barcode_scan(
    transmittal_id: int,
    body: TransmittalInBarcodeScanBody,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
):
    """IN transmittal: each scan completes that step — receptionist first, then recipient (no separate approval)."""
    phase = (body.phase or "").strip().lower()
    if phase not in ("receptionist", "recipient"):
        raise HTTPException(status_code=400, detail="phase must be receptionist or recipient")
    user_id, fn = _auth_user_row(authorization)
    now = datetime.utcnow()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM transmittals WHERE id = %s", (transmittal_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Transmittal not found")
            if not _in_ok_for_scan(row):
                raise HTTPException(status_code=400, detail="IN transmittal is rejected or cannot be scanned.")
            if phase == "receptionist":
                if row.get("received_by_receptionist_at"):
                    raise HTTPException(
                        status_code=400,
                        detail="Receptionist step is already done. Recipient should scan the barcode next.",
                    )
                _insert_scan_event(cur, transmittal_id, EVENT_RECEPTIONIST_IN_SCAN, user_id, fn)
                cur.execute(
                    """UPDATE transmittals SET received_by_receptionist_at = %s,
                       received_by_receptionist_name = COALESCE(%s, received_by_receptionist_name) WHERE id = %s""",
                    (now, fn, transmittal_id),
                )
            else:
                if not row.get("received_by_receptionist_at"):
                    raise HTTPException(
                        status_code=400,
                        detail="Receptionist must scan first.",
                    )
                if row.get("received_by_recipient_at"):
                    raise HTTPException(status_code=400, detail="This transmittal is already fully received")
                _insert_scan_event(cur, transmittal_id, EVENT_RECIPIENT_IN_SCAN, user_id, fn)
                cur.execute(
                    """UPDATE transmittals SET received_by_recipient_at = %s,
                       received_by_recipient_name = COALESCE(%s, received_by_recipient_name) WHERE id = %s""",
                    (now, fn, transmittal_id),
                )
            return _response_from_id(cur, transmittal_id, True)


@router.patch("/{transmittal_id}/status", response_model=TransmittalResponse)
def update_transmittal_status(
    transmittal_id: int,
    body: TransmittalStatusUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("transmittal")),
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
            if in_out != "in":
                raise HTTPException(status_code=400, detail="Only IN transmittals use receptionist receipt")
            if not _in_ok_for_scan(row):
                raise HTTPException(status_code=400, detail="Transmittal is rejected or invalid for this action")
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
            if in_out != "in":
                raise HTTPException(status_code=400, detail="Only IN transmittals use recipient receipt")
            if not _in_ok_for_scan(row):
                raise HTTPException(status_code=400, detail="Transmittal is rejected or invalid for this action")
            if not row.get("received_by_receptionist_at"):
                raise HTTPException(
                    status_code=400,
                    detail="Receptionist must scan the barcode and confirm receipt first",
                )
            if row.get("received_by_recipient_at"):
                raise HTTPException(status_code=400, detail="Recipient receipt already recorded")
            _insert_scan_event(cur, transmittal_id, EVENT_RECIPIENT_RECEIVED, user_id, name)
            cur.execute(
                """UPDATE transmittals SET received_by_recipient_at = %s, received_by_recipient_name = COALESCE(%s, received_by_recipient_name)
                   WHERE id = %s""",
                (now, name, transmittal_id),
            )
            return _response_from_id(cur, transmittal_id, True)


def _next_transmittal_number_for_year(cursor, year: int) -> str:
    """Same format as gate pass: YYYY + 4-digit sequence, e.g. 20260001."""
    prefix = str(year)
    cursor.execute(
        "SELECT MAX(transmittal_number) AS max_num FROM transmittals WHERE transmittal_number LIKE %s AND LENGTH(transmittal_number) = 8",
        (f"{prefix}%",),
    )
    row = cursor.fetchone()
    max_num = row.get("max_num") if row else None
    if max_num and max_num.startswith(prefix):
        try:
            seq = int(max_num[4:], 10) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


@router.post("", response_model=TransmittalResponse)
def create_transmittal(body: TransmittalCreate, authorization: str = Header(None, alias="Authorization"), _=Depends(require_system("transmittal"))):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            year = body.transmittal_date.year if hasattr(body.transmittal_date, "year") else int(str(body.transmittal_date)[:4])
            transmittal_number = _next_transmittal_number_for_year(cur, year)
            in_out = (body.in_or_out or "out").strip().lower()[:10]
            if in_out not in ("in", "out"):
                in_out = "out"
            # IN: no admin approval — ready for receptionist / recipient scans immediately
            init_status = "approved" if in_out == "in" else "pending"
            init_date_approved = date_type.today() if in_out == "in" else None
            cur.execute(
                """INSERT INTO transmittals (transmittal_number, transmittal_date, recipient_name, in_or_out,
                   purpose_return, purpose_inter_warehouse, purpose_others,
                   vehicle_type, plate_no, truck_seal_no, prepared_by, checked_by, recommended_by, approved_by, time_out, time_in,
                   status, date_approved)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    transmittal_number,
                    body.transmittal_date,
                    body.recipient_name,
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
