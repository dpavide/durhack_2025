from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from gmap.call_gmaps import call_gmaps

router = APIRouter()

class GMapSearchRequest(BaseModel):
    name: str
    lat: float
    lng: float
    radius: Optional[int] = 100

# FIX 1: Changed path from "/gmap/search" to "/search"
@router.get("/search") 
def gmap_search_get(
    name: str = Query(..., description="Place name to search for"),
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: int = Query(100, description="Search radius in meters")
):
    """
    Search for a place via Google Maps using query parameters.
    """
    try:
        result = call_gmaps(name, lat, lng, radius)
        if not result:
            raise HTTPException(status_code=404, detail="Place not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# FIX 2: Changed path from "/gmap/search" to "/search"
@router.post("/search")
def gmap_search_post(payload: GMapSearchRequest):
    """
    Search for a place via Google Maps using JSON body.
    """
    try:
        result = call_gmaps(payload.name, payload.lat, payload.lng, payload.radius)
        if not result:
            raise HTTPException(status_code=404, detail="Place not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))