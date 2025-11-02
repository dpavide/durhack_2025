# api/map/leaflet_to_overpass.py
"""
Utilities to parse Leaflet-style latlng JSON and query Overpass API.
"""

from typing import List, Tuple, Dict, Any, Union
import requests

# Overpass API endpoint (public). You can change to any Overpass instance if needed.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def extract_polygons_from_frontend_json(data: List[Dict[str, Any]]) -> List[List[Tuple[float, float]]]:
    """
    Extract polygons from the frontend JSON structure.

    Expected input example:
    [
      {
        "id": 144,
        "latlngs": {
            "0": [
                {"lat": 24.2234235235, "lng": 56.2342402849},
                {"lat": 24.22342352234, "lng": 56.34234802384},
                ...
            ]
        }
      },
      ...
    ]

    Returns a list of polygons, where each polygon is a list of (lat, lon) tuples.
    """
    polygons = []
    for item in data:
        latlngs = item.get("latlngs", {})
        # latlngs might be dict keyed by layer index ("0","1",...)
        # or a list directly. Handle both.
        if isinstance(latlngs, dict):
            for key, poly in latlngs.items():
                if isinstance(poly, list):
                    coords = []
                    for p in poly:
                        # Accept keys "lat","lng" or "lat","lon"
                        lat = p.get("lat") or p.get("latitude") or p.get("Lat")
                        lon = p.get("lng") or p.get("lon") or p.get("longitude") or p.get("Lng")
                        if lat is None or lon is None:
                            continue
                        coords.append((float(lat), float(lon)))
                    if coords:
                        polygons.append(coords)
        elif isinstance(latlngs, list):
            coords = []
            for p in latlngs:
                lat = p.get("lat") or p.get("latitude")
                lon = p.get("lng") or p.get("lon") or p.get("longitude")
                if lat is None or lon is None:
                    continue
                coords.append((float(lat), float(lon)))
            if coords:
                polygons.append(coords)
    return polygons


def polygon_to_overpass_poly_string(polygon: List[Tuple[float, float]]) -> str:
    """
    Convert polygon list of (lat, lon) to Overpass 'poly' string format:
    "lat lon lat lon lat lon ..."
    Ensures polygon is closed (first == last). Overpass accepts non-closed too, but closing is safer.
    """
    if not polygon:
        return ""
    coords = polygon[:]
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    parts = []
    for lat, lon in coords:
        parts.append(f"{lat} {lon}")
    return " ".join(parts)


def build_overpass_query(poly_string: str, amenity: Union[str, List[str]] = "restaurant", timeout: int = 25) -> str:
    """
    Build an Overpass QL query returning nodes, ways, relations for one or multiple amenity values.

    `amenity` can be a string like "restaurant" or "amenity=restaurant" or a list like
    ["amenity=bar", "amenity=cafe"] or ["bar","cafe"].

    The function will normalize and generate an Overpass union:
        ( node["amenity"="..."](poly:"...");
          way["amenity"="..."](poly:"...");
          relation["amenity"="..."](poly:"...");
        );
        out center;
    """
    # Normalize amenity parameter into list of key/value strings like amenity=bar
    if isinstance(amenity, str):
        # If user passed "amenity=bar" keep it; if just "bar", prepend "amenity="
        if "=" in amenity:
            amen_list = [amenity]
        else:
            amen_list = [f"amenity={amenity}"]
    else:
        # amenity is list
        amen_list = []
        for a in amenity:
            if not isinstance(a, str):
                continue
            a = a.strip()
            if not a:
                continue
            if "=" in a:
                amen_list.append(a)
            else:
                amen_list.append(f"amenity={a}")

    # Build the union clause with node/way/relation for each amenity
    clauses = []
    for a in amen_list:
        try:
            k, v = a.split("=", 1)
            k = k.strip()
            v = v.strip()
        except Exception:
            # fallback: treat as amenity=<value>
            k = "amenity"
            v = a.strip()
        clauses.append(f'  node["{k}"="{v}"](poly:"{poly_string}");')
        clauses.append(f'  way["{k}"="{v}"](poly:"{poly_string}");')
        clauses.append(f'  relation["{k}"="{v}"](poly:"{poly_string}");')

    clauses_text = "\n".join(clauses)
    q = f"""
[out:json][timeout:{timeout}];
(
{clauses_text}
);
out center;
"""
    return q.strip()


def query_overpass(overpass_query: str) -> Dict[str, Any]:
    """
    Send an Overpass query and return parsed JSON. Raises requests.HTTPError on bad HTTP responses.
    """
    resp = requests.post(OVERPASS_URL, data={"data": overpass_query}, timeout=60)
    resp.raise_for_status()
    return resp.json()
