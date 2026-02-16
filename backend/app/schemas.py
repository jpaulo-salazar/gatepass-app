from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "encoding"

class UserUpdate(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "encoding"

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: str

class UserEncode(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "encoding"

class ProductCreate(BaseModel):
    item_code: str
    item_description: str
    item_group: Optional[str] = None

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
    items: List[GatePassItemResponse]

class GatePassStatusUpdate(BaseModel):
    status: str
    rejected_remarks: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
