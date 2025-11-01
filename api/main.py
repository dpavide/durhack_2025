from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

# Router imports
from api.routers.map.overpass_routers import router as overpass_router
from api.routers.gmap.gmaps_routers import router as gmaps_router

# app = FastAPI()
try:
    from supabase import create_client, Client
except Exception:
    create_client = None
    Client = None

app = FastAPI(
    title="Vercel + FastAPI",
    description="Vercel + FastAPI",
    version="1.0.0",
)

app.include_router(overpass_router, prefix="/api/map", tags=["map"])
app.include_router(gmaps_router, prefix="/api/gmap", tags=["gmap"])


# CORS for local dev; tighten for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
_supa = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if (create_client and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) else None

class SignDownloadRequest(BaseModel):
    bucket: str
    path: str
    expires_in: int = 3600

@app.post("/api/storage/sign-download")
def sign_download(req: SignDownloadRequest):
    if not _supa:
        return {"error": "Server storage not configured"}
    res = _supa.storage.from_(req.bucket).create_signed_url(req.path, req.expires_in)
    url = (res or {}).get("signed_url")
    if not url:
        return {"error": "Failed to create signed URL", "details": res}
    return {"url": url}

@app.get("/api/storage/list")
def list_objects(bucket: str, prefix: str = ""):
    if not _supa:
        return {"error": "Server storage not configured"}
    items = _supa.storage.from_(bucket).list(prefix)
    files = [{"name": i.get("name")} for i in (items or [])]
    return {"files": files}

class DeleteObjectRequest(BaseModel):
    bucket: str
    path: str

@app.delete("/api/storage/object")
def delete_object(req: DeleteObjectRequest):
    if not _supa:
        return {"error": "Server storage not configured"}
    res = _supa.storage.from_(req.bucket).remove([req.path])
    return {"result": res}


@app.get("/api/data")
def get_sample_data():
    return {
        "data": [
            {"id": 1, "name": "Sample Item 1", "value": 100},
            {"id": 2, "name": "Sample Item 2", "value": 200},
            {"id": 3, "name": "Sample Item 3", "value": 300}
        ],
        "total": 3,
        "timestamp": "2024-01-01T00:00:00Z"
    }


@app.get("/api/items/{item_id}")
def get_item(item_id: int):
    return {
        "item": {
            "id": item_id,
            "name": "Sample Item " + str(item_id),
            "value": item_id * 100
        },
        "timestamp": "2024-01-01T00:00:00Z"
    }


@app.get("/api/health")
def health():
    """Simple health endpoint for the API server."""
    return {"status": "ok"}


# If integration between backend and frontend fails try to undoc / uncomment this 

"""
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

"""