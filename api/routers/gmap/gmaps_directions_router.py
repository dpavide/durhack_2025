import os
import requests
import polyline
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Tuple, Optional, Dict, Any

router = APIRouter()

# --- Configuration ---
# You MUST set this environment variable for the router to work
GMAPS_API_KEY = os.environ.get("GMAPS_API_KEY", "YOUR_GOOGLE_MAPS_API_KEY_HERE")
GMAPS_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"

# --- Request/Response Schemas ---

class LatLng(BaseModel):
    """Represents a simple Lat/Lng coordinate pair."""
    lat: float
    lng: float

class ComputeRoutesRequest(BaseModel):
    """Schema matching the front-end request."""
    origin: LatLng
    destination: LatLng
    travel_mode: str = "DRIVING"

class ComputeRoutesResponse(BaseModel):
    """Schema matching the required front-end response."""
    polyline: List[Tuple[float, float]] # List of [lat, lon] pairs
    distance_meters: Optional[int]
    duration_seconds: Optional[int]

# --- Router Endpoint ---

@router.post("/compute-routes", response_model=ComputeRoutesResponse)
async def compute_routes(req: ComputeRoutesRequest = Body(...)):
    """
    Computes a driving route between two points using the Google Directions API 
    and returns the polyline, distance, and duration.
    """
    if not GMAPS_API_KEY:
        raise HTTPException(
            status_code=500, detail="GMAPS_API_KEY environment variable not set."
        )

    # Convert Pydantic models to strings for the Directions API request
    origin_str = f"{req.origin.lat},{req.origin.lng}"
    destination_str = f"{req.destination.lat},{req.destination.lng}"
    
    params = {
        "origin": origin_str,
        "destination": destination_str,
        "mode": req.travel_mode.lower(),
        "key": GMAPS_API_KEY,
    }

    try:
        # 1. Call the external Google Directions API
        response = requests.get(GMAPS_DIRECTIONS_URL, params=params)
        response.raise_for_status() # Raise exception for bad status codes
        data = response.json()

        # 2. Extract necessary data from the first route found
        if data["status"] != "OK":
            # IMPROVED ERROR HANDLING: Catch status codes like ZERO_RESULTS, NOT_FOUND, etc.
            status = data.get("status", "UNKNOWN_ERROR")
            detail = data.get("error_message", f"Route calculation failed with status: {status}")
            
            # Use 400 Bad Request if the parameters/input failed, otherwise 503 Service Unavailable
            http_status = 400 if status in ["ZERO_RESULTS", "NOT_FOUND", "INVALID_REQUEST"] else 503
            
            raise HTTPException(
                status_code=http_status, 
                detail=f"Google Directions API Error: {detail}"
            )
            
        if not data["routes"]:
             # This handles the case where status is OK but routes list is empty (should be caught by ZERO_RESULTS but is safer)
            raise HTTPException(
                status_code=404, 
                detail="Google Directions API Error: Route calculated but result set was empty."
            )

        route = data["routes"][0]
        leg = route["legs"][0]

        # Google returns the polyline as an encoded string. We must decode it.
        encoded_polyline = route["overview_polyline"]["points"]
        
        # Decode the polyline string into a list of [lat, lon] tuples
        decoded_coords = polyline.decode(encoded_polyline)

        # 3. Format response for the front-end
        return ComputeRoutesResponse(
            # Leaflet expects [[lat, lon], ...]
            polyline=decoded_coords, 
            distance_meters=leg["distance"]["value"],
            duration_seconds=leg["duration"]["value"],
        )

    except requests.exceptions.HTTPError as e:
        # Catch network or non-200 errors from Google (e.g., 403 Forbidden due to bad API key)
        raise HTTPException(status_code=e.response.status_code, detail=f"Google API call failed: {e}")
    except Exception as e:
        # Catch any other unexpected Python errors
        raise HTTPException(status_code=500, detail=f"Internal server error during routing: {e}")
