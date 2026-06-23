"""Intransit destination options for barcode release scans."""

from fastapi import HTTPException

VALID_INTRANSIT = frozenset({"Delivery", "Atlanta", "Geomax", "Plaridel", "Ramitex"})

EVENT_RELEASE_BARCODE_SCAN = "release_barcode_scan"


def normalize_intransit(value: str) -> str:
    v = (value or "").strip()
    if v not in VALID_INTRANSIT:
        opts = ", ".join(sorted(VALID_INTRANSIT))
        raise HTTPException(status_code=400, detail=f"intransit must be one of: {opts}")
    return v
