import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes import auth, users, products, gate_passes

# CORS: default localhost; set BACKEND_CORS_ORIGINS for LAN (e.g. http://192.168.1.100:5173,http://localhost:5173)
_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
_cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "").strip()
if _cors_origins:
    _origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]
else:
    _origins = _default_origins

app = FastAPI(title="Gate Pass API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(products.router)
app.include_router(gate_passes.router)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Gate Pass API"}
