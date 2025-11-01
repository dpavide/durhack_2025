from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

# Import our helper functions
from map.leaflet_to_overpass import (
    extract_polygons_from_frontend_json,
    polygon_to_overpass_poly_string,
    build_overpass_query,
    query_overpass,
)

router = APIRouter()

# ---------- SAMPLE GLOBAL JSON (you said you wanted it in a global var for now) ----------
SAMPLE_DATA = [
    {
        "id": 144,
        "latlngs": {
            "0": [
                {"lat": 52.4866351, "lng":  -1.9114572},
                {"lat": 52.4773476, "lng":  -1.9132928},
                {"lat": 52.4772993, "lng": -1.8930263},
                {"lat": 52.4827054, "lng": -1.8936392},
            ]
        }
    }
]
# ----------------------------------------------------------------------------------------

# Simple Pydantic model in case we want to accept a body POST later
class FrontendPolygonItem(BaseModel):
    id: Optional[int]
    latlngs: Dict[str, List[Dict[str, float]]]


class OverpassResponseModel(BaseModel):
    elements: List[Dict[str, Any]]


@router.get("/search", response_model=OverpassResponseModel)
def search_overpass(amenity: str = Query("restaurant", description="Amenity to search for (default: restaurant)")):
    """
    Use the SAMPLE_DATA global variable, parse polygon(s), query Overpass for the given amenity,
    and return Overpass's JSON 'elements' list.
    """
    try:
        polygons = extract_polygons_from_frontend_json(SAMPLE_DATA)
        if not polygons:
            raise HTTPException(status_code=400, detail="No polygons found in SAMPLE_DATA.")

        # For simplicity we will query using the first polygon found.
        # If you want to query multiple polygons, you can loop and merge results client-side.
        first_polygon = polygons[0]
        poly_str = polygon_to_overpass_poly_string(first_polygon)
        if not poly_str:
            raise HTTPException(status_code=400, detail="Invalid polygon coordinates.")

        query = build_overpass_query(poly_str, amenity=amenity)
        raw = query_overpass(query)

        # The Overpass response has top-level keys like 'version', 'elements', etc.
        elements = raw.get("elements", [])
        return {"elements": elements}

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Error while querying Overpass")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/search", response_model=OverpassResponseModel)
def search_overpass_post(payload: List[FrontendPolygonItem], amenity: str = Query("restaurant", description="Amenity to search for")):
    """
    Accept a POST body (list of polygon items in the same structure as SAMPLE_DATA), parse polygons,
    and query Overpass. Useful once frontend sends its JSON here directly.
    """
    try:
        # Convert Pydantic models to dicts
        payload_dicts = [p.dict() for p in payload]
        polygons = extract_polygons_from_frontend_json(payload_dicts)
        if not polygons:
            raise HTTPException(status_code=400, detail="No polygons found in payload.")

        first_polygon = polygons[0]
        poly_str = polygon_to_overpass_poly_string(first_polygon)
        if not poly_str:
            raise HTTPException(status_code=400, detail="Invalid polygon coordinates.")

        query = build_overpass_query(poly_str, amenity=amenity)
        raw = query_overpass(query)
        elements = raw.get("elements", [])
        return {"elements": elements}

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Error while querying Overpass (POST)")
        raise HTTPException(status_code=500, detail=str(exc))
