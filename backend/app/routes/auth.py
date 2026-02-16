import bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from jose import JWTError, jwt
from app.database import get_db
from app.schemas import LoginRequest, TokenResponse, UserResponse

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

router = APIRouter(prefix="/auth", tags=["auth"])

def hash_password(password: str) -> str:
    """Bcrypt hash; input truncated to 72 bytes (bcrypt limit)."""
    pw = (password or "")[:72].encode("utf-8")
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw((password or "").encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

@router.options("/login")
def login_options(request: Request):
    """CORS preflight: return 200 with CORS headers so browser can send POST."""
    origin = request.headers.get("origin") or "*"
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        },
    )

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, password_hash, full_name, role FROM users WHERE username = %s", (req.username,))
            row = cur.fetchone()
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    role = row["role"] or "admin"
    user = UserResponse(id=row["id"], username=row["username"], full_name=row["full_name"], role=role)
    token = create_access_token({"sub": str(row["id"]), "username": row["username"], "role": role})
    return TokenResponse(access_token=token, user=user)
