"""Per-year document numbers (YYYYNNNN). Counters persist when history rows are deleted."""

from fastapi import HTTPException

KIND_GATE_PASS = "gate_pass"
KIND_TRANSMITTAL = "transmittal"


def allocate_yyyy_nnnn_number(cursor, kind: str, year: int) -> str:
    """Next number for the given kind and calendar year; updates document_series under row lock."""
    prefix = str(year)
    if len(prefix) != 4 or not prefix.isdigit():
        raise HTTPException(status_code=400, detail="Invalid year for document number")

    if kind == KIND_GATE_PASS:
        table, col = "gate_passes", "gp_number"
    elif kind == KIND_TRANSMITTAL:
        table, col = "transmittals", "transmittal_number"
    else:
        raise HTTPException(status_code=500, detail="Invalid document kind")

    cursor.execute(
        "INSERT IGNORE INTO document_series (kind, year, last_seq) VALUES (%s, %s, 0)",
        (kind, year),
    )
    cursor.execute(
        "SELECT last_seq FROM document_series WHERE kind = %s AND year = %s FOR UPDATE",
        (kind, year),
    )
    row = cursor.fetchone()
    series_seq = int(row["last_seq"]) if row else 0

    cursor.execute(
        f"SELECT MAX({col}) AS max_num FROM {table} WHERE {col} LIKE %s AND LENGTH({col}) = 8",
        (f"{prefix}%",),
    )
    r2 = cursor.fetchone()
    max_num = r2.get("max_num") if r2 else None
    max_from_table = 0
    if max_num and str(max_num).startswith(prefix) and len(str(max_num)) == 8:
        try:
            max_from_table = int(str(max_num)[4:], 10)
        except ValueError:
            max_from_table = 0

    next_seq = max(series_seq, max_from_table) + 1
    if next_seq > 9999:
        raise HTTPException(status_code=400, detail="Document number sequence is full for this year")

    cursor.execute(
        "UPDATE document_series SET last_seq = %s WHERE kind = %s AND year = %s",
        (next_seq, kind, year),
    )
    return f"{prefix}{next_seq:04d}"
