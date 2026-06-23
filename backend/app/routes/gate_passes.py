from fastapi import APIRouter, Header, HTTPException, Depends
from app.database import get_db
from app.document_series import KIND_GATE_PASS, allocate_yyyy_nnnn_number
from app.intransit import EVENT_RELEASE_BARCODE_SCAN, normalize_intransit
from app.schemas import (
    BarcodeReleaseScanBody,
    GatePassCreate,
    GatePassUpdate,
    GatePassResponse,
    GatePassItemResponse,
    GatePassScanEventResponse,
    GatePassStatusUpdate,
)
from app.routes.users import get_current_user_id, require_system, role_required

router = APIRouter(prefix="/gate-passes", tags=["gate-passes"])


def _dt_iso(val):
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _scan_event_from_row(r) -> GatePassScanEventResponse:
    return GatePassScanEventResponse(
        id=r["id"],
        event_type=r["event_type"],
        created_at=_dt_iso(r.get("created_at")) or "",
        user_id=r.get("user_id"),
        user_full_name=r.get("user_full_name"),
        intransit=r.get("intransit"),
    )


def _fetch_scan_events(cur, gate_pass_id: int) -> list[GatePassScanEventResponse]:
    cur.execute(
        """SELECT id, event_type, created_at, user_id, user_full_name, intransit
           FROM gate_pass_scan_events WHERE gate_pass_id = %s ORDER BY id ASC""",
        (gate_pass_id,),
    )
    return [_scan_event_from_row(x) for x in cur.fetchall()]


def _insert_scan_event(
    cur,
    gate_pass_id: int,
    event_type: str,
    user_id: int | None,
    user_full_name: str | None,
    intransit: str | None = None,
):
    cur.execute(
        """INSERT INTO gate_pass_scan_events
           (gate_pass_id, event_type, user_id, user_full_name, intransit)
           VALUES (%s, %s, %s, %s, %s)""",
        (gate_pass_id, event_type, user_id, user_full_name, intransit),
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


def _row_to_response(gp_row, items_rows, scan_events: list[GatePassScanEventResponse] | None = None):
    if scan_events is None:
        scan_events = []
    return GatePassResponse(
        id=gp_row["id"],
        gp_number=gp_row["gp_number"],
        pass_date=gp_row["pass_date"],
        authorized_name=gp_row["authorized_name"],
        in_or_out=gp_row.get("in_or_out") or "out",
        purpose_delivery=bool(gp_row["purpose_delivery"]),
        purpose_return=bool(gp_row["purpose_return"]),
        purpose_inter_warehouse=bool(gp_row["purpose_inter_warehouse"]),
        purpose_others=bool(gp_row["purpose_others"]),
        vehicle_type=gp_row["vehicle_type"],
        plate_no=gp_row["plate_no"],
        attention=gp_row.get("attention"),
        prepared_by=gp_row["prepared_by"],
        checked_by=gp_row["checked_by"],
        recommended_by=gp_row["recommended_by"],
        approved_by=gp_row["approved_by"],
        time_out=gp_row["time_out"],
        time_in=gp_row["time_in"],
        status=gp_row.get("status"),
        rejected_remarks=gp_row.get("rejected_remarks"),
        date_approved=gp_row.get("date_approved"),
        items=[GatePassItemResponse(id=r["id"], item_code=r["item_code"], item_description=r["item_description"],
                                    qty=r["qty"], ref_doc_no=r["ref_doc_no"], destination=r["destination"])
               for r in items_rows],
        scan_events=scan_events,
    )

@router.get("", response_model=list[GatePassResponse])
def list_gate_passes(
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes ORDER BY id DESC")
            passes = cur.fetchall()
            result = []
            for gp in passes:
                cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gp["id"],))
                items = cur.fetchall()
                ev = _fetch_scan_events(cur, gp["id"])
                result.append(_row_to_response(gp, items, ev))
    return result

@router.get("/by-number/{gp_number}", response_model=GatePassResponse)
def get_by_gp_number(gp_number: str, authorization: str = None):
    """Used by scanner: look up gate pass by GP number (barcode value). No auth required for scanning."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes WHERE gp_number = %s", (gp_number.strip(),))
            gp = cur.fetchone()
            if not gp:
                raise HTTPException(status_code=404, detail="Gate pass not found")
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gp["id"],))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, gp["id"])
    return _row_to_response(gp, items, ev)

@router.get("/{gate_pass_id}", response_model=GatePassResponse)
def get_gate_pass(
    gate_pass_id: int,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            if not gp:
                raise HTTPException(status_code=404, detail="Gate pass not found")
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, gate_pass_id)
    return _row_to_response(gp, items, ev)


@router.post("/{gate_pass_id}/release-barcode-scan", response_model=GatePassResponse)
def record_release_barcode_scan(
    gate_pass_id: int,
    body: BarcodeReleaseScanBody,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("scan_only", "encoding", "admin")),
):
    """Guard Scan Barcode page: record release scan with Intransit destination."""
    user_id, fn = _auth_user_row(authorization)
    intransit = normalize_intransit(body.intransit)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Gate pass not found")
            if (row.get("status") or "").lower() != "approved":
                raise HTTPException(status_code=400, detail="Only approved gate passes can be release-scanned.")
            _insert_scan_event(cur, gate_pass_id, EVENT_RELEASE_BARCODE_SCAN, user_id, fn, intransit)
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, gate_pass_id)
    return _row_to_response(gp, items, ev)


@router.patch("/{gate_pass_id}/status", response_model=GatePassResponse)
def update_gate_pass_status(
    gate_pass_id: int,
    body: GatePassStatusUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("encoding", "admin", "approve_only")),
):
    """Update gate pass status (e.g. approved, rejected) and optional rejected_remarks. On approve, set approved_by and date_approved."""
    get_current_user_id(authorization)
    status = (body.status or "").strip().lower() or None
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be pending, approved, or rejected")
    rejected_remarks = body.rejected_remarks if status == "rejected" else None
    approved_by = (body.approved_by or "").strip() or None if status == "approved" else None
    from datetime import date as date_type
    date_approved = date_type.today() if status == "approved" else None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM gate_passes WHERE id = %s", (gate_pass_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Gate pass not found")
            if status == "approved":
                cur.execute(
                    "UPDATE gate_passes SET status = %s, rejected_remarks = NULL, approved_by = COALESCE(%s, approved_by), date_approved = %s WHERE id = %s",
                    (status, approved_by, date_approved, gate_pass_id),
                )
            else:
                cur.execute(
                    "UPDATE gate_passes SET status = %s, rejected_remarks = %s WHERE id = %s",
                    (status, rejected_remarks, gate_pass_id),
                )
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, gate_pass_id)
    return _row_to_response(gp, items, ev)


@router.post("/clear-history")
def clear_gate_pass_history(
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("admin")),
):
    """Remove all gate passes and line items. Document numbers (YYYYNNNN) continue from the stored counter."""
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM gate_passes")
            n = int(cur.fetchone()["c"])
            cur.execute("DELETE FROM gate_passes")
    return {
        "deleted": n,
        "message": "All gate passes removed. New passes will use the next sequence number (not reset to 0001).",
    }


@router.put("/{gate_pass_id}", response_model=GatePassResponse)
def update_gate_pass(
    gate_pass_id: int,
    body: GatePassUpdate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("encoding", "admin")),
):
    """Edit an existing gate pass. Resets status to 'pending' for re-approval."""
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM gate_passes WHERE id = %s", (gate_pass_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Gate pass not found")
            in_out = (body.in_or_out or "out").strip().lower()[:10]
            if in_out not in ("in", "out"):
                in_out = "out"
            cur.execute(
                """UPDATE gate_passes SET
                       pass_date = %s,
                       authorized_name = %s,
                       in_or_out = %s,
                       purpose_delivery = %s,
                       purpose_return = %s,
                       purpose_inter_warehouse = %s,
                       purpose_others = %s,
                       vehicle_type = %s,
                       plate_no = %s,
                       attention = %s,
                       prepared_by = %s,
                       checked_by = %s,
                       recommended_by = %s,
                       approved_by = %s,
                       time_out = %s,
                       time_in = %s,
                       status = 'pending',
                       date_approved = NULL,
                       rejected_remarks = NULL
                   WHERE id = %s""",
                (
                    body.pass_date,
                    body.authorized_name,
                    in_out,
                    int(body.purpose_delivery),
                    int(body.purpose_return),
                    int(body.purpose_inter_warehouse),
                    int(body.purpose_others),
                    body.vehicle_type,
                    body.plate_no,
                    body.attention,
                    body.prepared_by,
                    body.checked_by,
                    body.recommended_by,
                    body.approved_by,
                    body.time_out,
                    body.time_in,
                    gate_pass_id,
                ),
            )
            cur.execute("DELETE FROM gate_pass_items WHERE gate_pass_id = %s", (gate_pass_id,))
            for it in body.items:
                cur.execute(
                    """INSERT INTO gate_pass_items (gate_pass_id, item_code, item_description, qty, ref_doc_no, destination)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (gate_pass_id, it.item_code, it.item_description, it.qty, it.ref_doc_no, it.destination),
                )
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
            ev = _fetch_scan_events(cur, gate_pass_id)
    return _row_to_response(gp, items, ev)


@router.post("", response_model=GatePassResponse)
def create_gate_pass(
    body: GatePassCreate,
    authorization: str = Header(None, alias="Authorization"),
    _=Depends(require_system("gatepass")),
    __=Depends(role_required("encoding", "admin")),
):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            year = body.pass_date.year if hasattr(body.pass_date, "year") else int(str(body.pass_date)[:4])
            gp_number = allocate_yyyy_nnnn_number(cur, KIND_GATE_PASS, year)
            in_out = (body.in_or_out or "out").strip().lower()[:10]
            if in_out not in ("in", "out"):
                in_out = "out"
            cur.execute("""
                INSERT INTO gate_passes (gp_number, pass_date, authorized_name, in_or_out,
                    purpose_delivery, purpose_return, purpose_inter_warehouse, purpose_others,
                    vehicle_type, plate_no, attention, prepared_by, checked_by, recommended_by, approved_by, time_out, time_in)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (gp_number, body.pass_date, body.authorized_name, in_out,
                  int(body.purpose_delivery), int(body.purpose_return), int(body.purpose_inter_warehouse), int(body.purpose_others),
                  body.vehicle_type, body.plate_no, body.attention, body.prepared_by, body.checked_by, body.recommended_by, body.approved_by,
                  body.time_out, body.time_in))
            gate_pass_id = cur.lastrowid
            for it in body.items:
                cur.execute("""
                    INSERT INTO gate_pass_items (gate_pass_id, item_code, item_description, qty, ref_doc_no, destination)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (gate_pass_id, it.item_code, it.item_description, it.qty, it.ref_doc_no, it.destination))
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
    return _row_to_response(gp, items)
