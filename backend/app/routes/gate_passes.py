from fastapi import APIRouter, Header, HTTPException
from app.database import get_db
from app.schemas import GatePassCreate, GatePassResponse, GatePassItemResponse, GatePassStatusUpdate
from app.routes.users import get_current_user_id

router = APIRouter(prefix="/gate-passes", tags=["gate-passes"])

def _row_to_response(gp_row, items_rows):
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
        items=[GatePassItemResponse(id=r["id"], item_code=r["item_code"], item_description=r["item_description"],
                                    qty=r["qty"], ref_doc_no=r["ref_doc_no"], destination=r["destination"])
               for r in items_rows]
    )

@router.get("", response_model=list[GatePassResponse])
def list_gate_passes(authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes ORDER BY id DESC")
            passes = cur.fetchall()
            result = []
            for gp in passes:
                cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gp["id"],))
                items = cur.fetchall()
                result.append(_row_to_response(gp, items))
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
    return _row_to_response(gp, items)

@router.get("/{gate_pass_id}", response_model=GatePassResponse)
def get_gate_pass(gate_pass_id: int, authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            if not gp:
                raise HTTPException(status_code=404, detail="Gate pass not found")
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
    return _row_to_response(gp, items)


@router.patch("/{gate_pass_id}/status", response_model=GatePassResponse)
def update_gate_pass_status(
    gate_pass_id: int,
    body: GatePassStatusUpdate,
    authorization: str = Header(None, alias="Authorization"),
):
    """Update gate pass status (e.g. approved, rejected) and optional rejected_remarks."""
    get_current_user_id(authorization)
    status = (body.status or "").strip().lower() or None
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
    if status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be pending, approved, or rejected")
    rejected_remarks = body.rejected_remarks if status == "rejected" else None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM gate_passes WHERE id = %s", (gate_pass_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Gate pass not found")
            cur.execute(
                "UPDATE gate_passes SET status = %s, rejected_remarks = %s WHERE id = %s",
                (status, rejected_remarks, gate_pass_id),
            )
            cur.execute("SELECT * FROM gate_passes WHERE id = %s", (gate_pass_id,))
            gp = cur.fetchone()
            cur.execute("SELECT * FROM gate_pass_items WHERE gate_pass_id = %s ORDER BY id", (gate_pass_id,))
            items = cur.fetchall()
    return _row_to_response(gp, items)


def _next_gp_number_for_year(cursor, year: int) -> str:
    """Generate next GP number as year + 4-digit sequence, e.g. 20260001, 20260002."""
    prefix = str(year)
    cursor.execute(
        "SELECT MAX(gp_number) AS max_gp FROM gate_passes WHERE gp_number LIKE %s AND LENGTH(gp_number) = 8",
        (f"{prefix}%",),
    )
    row = cursor.fetchone()
    max_gp = row.get("max_gp") if row else None
    if max_gp and max_gp.startswith(prefix):
        try:
            seq = int(max_gp[4:], 10) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


@router.post("", response_model=GatePassResponse)
def create_gate_pass(body: GatePassCreate, authorization: str = Header(None, alias="Authorization")):
    get_current_user_id(authorization)
    with get_db() as conn:
        with conn.cursor() as cur:
            year = body.pass_date.year if hasattr(body.pass_date, "year") else int(str(body.pass_date)[:4])
            gp_number = _next_gp_number_for_year(cur, year)
            in_out = (body.in_or_out or "out").strip().lower()[:10]
            if in_out not in ("in", "out"):
                in_out = "out"
            # Omit 'attention' unless DB has it (run migrations/004_add_gatepass_attention.sql to add)
            cur.execute("""
                INSERT INTO gate_passes (gp_number, pass_date, authorized_name, in_or_out,
                    purpose_delivery, purpose_return, purpose_inter_warehouse, purpose_others,
                    vehicle_type, plate_no, prepared_by, checked_by, recommended_by, approved_by, time_out, time_in)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (gp_number, body.pass_date, body.authorized_name, in_out,
                  int(body.purpose_delivery), int(body.purpose_return), int(body.purpose_inter_warehouse), int(body.purpose_others),
                  body.vehicle_type, body.plate_no, body.prepared_by, body.checked_by, body.recommended_by, body.approved_by,
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
