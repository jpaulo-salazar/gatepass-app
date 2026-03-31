from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    role: str = "encoding"

class UserUpdate(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    role: str = "encoding"

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    department_id: Optional[int] = None
    department: Optional[str] = None  # resolved department name (for display)
    department_is_reception_desk: Optional[bool] = None  # True when user's department is marked reception desk
    role: str
    system: Optional[str] = None  # 'gatepass' | 'transmittal'

class UserEncode(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    role: str = "encoding"


class DepartmentCreate(BaseModel):
    name: str
    is_reception_desk: bool = False


class DepartmentUpdate(BaseModel):
    name: str
    is_reception_desk: bool = False


class DepartmentResponse(BaseModel):
    id: int
    name: str
    is_reception_desk: bool = False
    system: Optional[str] = None

class ProductCreate(BaseModel):
    item_code: str
    item_description: str
    item_group: Optional[str] = None


class ProductsBulkCreate(BaseModel):
    items: List[ProductCreate]


class ProductsBulkResponse(BaseModel):
    created: int
    skipped: int
    skipped_codes: List[str] = []


class ProductResponse(BaseModel):
    id: int
    item_code: str
    item_description: str
    item_group: Optional[str] = None

class GatePassItemCreate(BaseModel):
    item_code: Optional[str] = None
    item_description: str
    qty: int
    ref_doc_no: Optional[str] = None
    destination: Optional[str] = None

class GatePassItemResponse(BaseModel):
    id: int
    item_code: Optional[str]
    item_description: str
    qty: int
    ref_doc_no: Optional[str]
    destination: Optional[str]

class GatePassCreate(BaseModel):
    pass_date: date
    authorized_name: str
    in_or_out: str = "out"  # "in" or "out"
    purpose_delivery: bool = True
    purpose_return: bool = False
    purpose_inter_warehouse: bool = False
    purpose_others: bool = False
    vehicle_type: Optional[str] = None
    plate_no: Optional[str] = None
    attention: Optional[str] = None
    prepared_by: Optional[str] = None
    checked_by: Optional[str] = None
    recommended_by: Optional[str] = None
    approved_by: Optional[str] = None
    time_out: Optional[str] = None
    time_in: Optional[str] = None
    items: List[GatePassItemCreate]

class GatePassResponse(BaseModel):
    id: int
    gp_number: str
    pass_date: date
    authorized_name: str
    in_or_out: Optional[str] = None
    purpose_delivery: bool
    purpose_return: bool
    purpose_inter_warehouse: bool
    purpose_others: bool
    vehicle_type: Optional[str]
    plate_no: Optional[str]
    attention: Optional[str] = None
    prepared_by: Optional[str]
    checked_by: Optional[str]
    recommended_by: Optional[str]
    approved_by: Optional[str]
    time_out: Optional[str]
    time_in: Optional[str]
    status: Optional[str] = None
    rejected_remarks: Optional[str] = None
    date_approved: Optional[date] = None
    items: List[GatePassItemResponse]

class GatePassStatusUpdate(BaseModel):
    status: str
    rejected_remarks: Optional[str] = None
    approved_by: Optional[str] = None  # set when admin approves (e.g. current user full name)


# --- Document Transmittal ---
class TransmittalItemCreate(BaseModel):
    item_description: str
    qty: int
    ref_doc_no: Optional[str] = None
    destination: Optional[str] = None


class TransmittalItemResponse(BaseModel):
    id: int
    item_description: str
    qty: int
    ref_doc_no: Optional[str]
    destination: Optional[str]


class TransmittalScanEventResponse(BaseModel):
    id: int
    event_type: str
    created_at: str
    user_id: Optional[int] = None
    user_full_name: Optional[str] = None


class TransmittalCreate(BaseModel):
    transmittal_date: date
    recipient_name: str
    in_or_out: str = "out"
    purpose_return: bool = False
    purpose_inter_warehouse: bool = False
    purpose_others: bool = False
    vehicle_type: Optional[str] = None
    plate_no: Optional[str] = None
    truck_seal_no: Optional[str] = None
    prepared_by: Optional[str] = None
    checked_by: Optional[str] = None
    recommended_by: Optional[str] = None
    approved_by: Optional[str] = None
    time_out: Optional[str] = None
    time_in: Optional[str] = None
    items: List[TransmittalItemCreate]


class TransmittalResponse(BaseModel):
    id: int
    transmittal_number: str
    transmittal_date: date
    recipient_name: str
    in_or_out: Optional[str] = None
    purpose_return: bool
    purpose_inter_warehouse: bool
    purpose_others: bool
    vehicle_type: Optional[str]
    plate_no: Optional[str]
    truck_seal_no: Optional[str]
    prepared_by: Optional[str]
    checked_by: Optional[str]
    recommended_by: Optional[str]
    approved_by: Optional[str]
    time_out: Optional[str]
    time_in: Optional[str]
    status: Optional[str] = None
    rejected_remarks: Optional[str] = None
    date_approved: Optional[date] = None
    received_by_receptionist_at: Optional[str] = None
    received_by_receptionist_name: Optional[str] = None
    recipient_department: Optional[str] = None
    recipient_user_id: Optional[int] = None
    recipient_user_name: Optional[str] = None
    received_by_recipient_at: Optional[str] = None
    received_by_recipient_name: Optional[str] = None
    items: List[TransmittalItemResponse]
    scan_events: List[TransmittalScanEventResponse] = Field(default_factory=list)


class TransmittalStatusUpdate(BaseModel):
    status: str
    rejected_remarks: Optional[str] = None
    approved_by: Optional[str] = None


class TransmittalReceiveUpdate(BaseModel):
    received_by: Optional[str] = None  # name of receptionist or recipient


class TransmittalOutBarcodeScanBody(BaseModel):
    phase: str  # receptionist | recipient
    recipient_department_id: Optional[int] = None
    recipient_department: Optional[str] = None  # legacy / fallback when id not sent
    recipient_user_id: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str
    system: str = "gatepass"  # 'gatepass' | 'transmittal' - which user list to validate against

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
