import os
import requests
from dotenv import load_dotenv
from typing import Optional, Dict, Any

load_dotenv()
API_KEY = os.getenv("GMAPS_API_KEY")

if not API_KEY:
    raise RuntimeError("GMAPS_API_KEY not found in .env file")

# --- Helper functions ---

def find_place_id(name: str, lat: float, lng: float, radius: int = 100) -> Optional[str]:
    """
    Search for a place near the given location and return its Google Place ID.
    """
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "keyword": name,
        "location": f"{lat},{lng}",
        "radius": radius,
        "key": API_KEY,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    if data.get("status") == "OK" and data.get("results"):
        return data["results"][0]["place_id"]
    return None


def get_place_details(place_id: str) -> Dict[str, Any]:
    """
    Retrieve details (rating, review count, and reviews) for a given Place ID.
    """
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,rating,user_ratings_total,reviews,formatted_address",
        "key": API_KEY,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "OK":
        raise ValueError(f"Google Maps API error: {data.get('status')}")
    
    return data["result"]


def call_gmaps(name: str, lat: float, lng: float, radius: int = 100) -> Optional[Dict[str, Any]]:
    """
    Combined helper function - searches for a place and returns its full details.
    """
    place_id = find_place_id(name, lat, lng, radius)
    if not place_id:
        return None

    details = get_place_details(place_id)
    return details
