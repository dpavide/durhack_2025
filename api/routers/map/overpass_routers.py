# overpass_routers.py

from fastapi import APIRouter, HTTPException, Query, Body
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

# Import Google Maps helper
from gmap.call_gmaps import call_gmaps

router = APIRouter()

# ---------- SAMPLE GLOBAL JSON (in-memory) ----------
SAMPLE_DATA = [
    {
        "id": 144,
        "latlngs": {
            "0": [
                {"lat": 52.4866351, "lng": -1.9114572},
                {"lat": 52.4773476, "lng": -1.9132928},
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


def _get_latlon_from_element(el: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """
    Extract latitude/longitude from an Overpass element.
    Nodes have 'lat' and 'lon'. Ways/relations (when 'out center') have 'center': {'lat','lon'}.
    Returns dict {'lat': float, 'lon': float} or None if not available.
    """
    if el.get("lat") is not None and el.get("lon") is not None:
        return {"lat": float(el["lat"]), "lon": float(el["lon"])}
    center = el.get("center")
    if isinstance(center, dict) and center.get("lat") is not None and center.get("lon") is not None:
        return {"lat": float(center["lat"]), "lon": float(center["lon"])}
    return None


def _extract_addr_tags(tags: Dict[str, Any]) -> Dict[str, str]:
    """Return a dict of addr:* tags from the tags dict."""
    return {k: v for k, v in tags.items() if isinstance(k, str) and k.startswith("addr:")}


def _build_search_name(tags: Dict[str, Any]) -> str:
    """
    Construct a good 'name' string to pass to Google Maps:
    Prefer tags['name'] or tags['brand']. If not present, build from addr:* fields.
    Append street/city/housenumber where possible to make the search more precise.
    """
    if not tags:
        return ""
    # preferred name fields
    name = tags.get("name") or tags.get("brand") or tags.get("operator") or ""
    addr = _extract_addr_tags(tags)
    street = addr.get("addr:street") or addr.get("addr:place") or ""
    housenumber = addr.get("addr:housenumber") or ""
    city = addr.get("addr:city") or addr.get("addr:town") or addr.get("addr:village") or ""
    parts = []
    if name:
        parts.append(name)
    if housenumber:
        # place housenumber before street for address clarity
        if street:
            parts.append(f"{housenumber} {street}")
        else:
            parts.append(housenumber)
    elif street:
        parts.append(street)
    if city:
        parts.append(city)
    # fallback to amenity type if nothing else
    if not parts and tags.get("amenity"):
        parts.append(tags.get("amenity"))
    return " ".join([p for p in parts if p]).strip()


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
        payload_dicts = [p.model_dump() for p in payload]
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


# ---------------- New endpoint to accept frontend simple polygon and set SAMPLE_DATA ----------------
@router.post("/set_sample")
def set_sample(payload: List[Dict[str, Any]] = Body(...)):
    """
    Accept a simple list of coords [{lat: x, lng: y} or {lat: x, lon: y}] and
    set the module-level SAMPLE_DATA variable to a single-item list using the
    same structure as your existing SAMPLE_DATA:
      [ { "id": None, "latlngs": { "0": [ {lat, lng}, ... ] } } ]
    This endpoint returns a small confirmation JSON.
    """
    global SAMPLE_DATA
    try:
        coords = []
        for p in payload:
            if not isinstance(p, dict):
                continue
            # Accept multiple key names for robustness
            lat = p.get("lat") or p.get("latitude")
            lon = p.get("lng") or p.get("lon") or p.get("longitude")
            if lat is None or lon is None:
                continue
            coords.append({"lat": float(lat), "lng": float(lon)})

        if not coords:
            raise HTTPException(status_code=400, detail="No valid lat/lon pairs in payload.")

        # Update SAMPLE_DATA to the shape other endpoints expect
        SAMPLE_DATA = [{"id": None, "latlngs": {"0": coords}}]

        return {"status": "ok", "saved_points": len(coords)}
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Error in set_sample")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------- New endpoints that call Google Maps for the top N Overpass results ----------------
# Note: these endpoints now return ONLY the Google Maps summary (name, lat, lon, rating, up to reviews_n reviews).
# The full Overpass elements list is still available from /search and /search (POST).

@router.get("/search/gmap")
def search_overpass_with_gmap(
    amenity: str = Query("restaurant", description="Amenity to search for (default: restaurant)"),
    top_n: int = Query(3, description="How many top results to query Google Maps for (default 3)"),
    reviews_n: int = Query(2, description="How many reviews to return per place (default 2)")
):
    """
    Use SAMPLE_DATA polygon(s), query Overpass for `amenity`, and return a concise Google Maps summary
    for up to `top_n` Overpass elements: name, lat, lon, rating, and up to `reviews_n` reviews.
    """
    try:
        polygons = extract_polygons_from_frontend_json(SAMPLE_DATA)
        if not polygons:
            raise HTTPException(status_code=400, detail="No polygons found in SAMPLE_DATA.")

        first_polygon = polygons[0]
        poly_str = polygon_to_overpass_poly_string(first_polygon)
        if not poly_str:
            raise HTTPException(status_code=400, detail="Invalid polygon coordinates.")

        query = build_overpass_query(poly_str, amenity=amenity)
        raw = query_overpass(query)
        elements = raw.get("elements", [])

        top_elements = elements[:top_n]
        results = []

        for el in top_elements:
            el_latlon = _get_latlon_from_element(el)
            tags = el.get("tags", {}) or {}
            # skip elements without coords
            if not el_latlon:
                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "skipped": True,
                    "reason": "no lat/lon or center available in element",
                })
                continue

            search_name = _build_search_name(tags)
            if not search_name:
                search_name = tags.get("amenity", "")

            try:
                details = call_gmaps(search_name, el_latlon["lat"], el_latlon["lon"], radius=100)
                if not details:
                    # not found on Google Maps
                    results.append({
                        "element_id": el.get("id"),
                        "osm_type": el.get("type"),
                        "name": search_name,
                        "lat": el_latlon["lat"],
                        "lon": el_latlon["lon"],
                        "rating": None,
                        "reviews": [],
                        "found_on_gmaps": False,
                    })
                    continue

                place_name = details.get("name") or search_name
                rating = details.get("rating")
                raw_reviews = details.get("reviews") or []
                extracted_reviews = []
                for rev in raw_reviews[:reviews_n]:
                    extracted_reviews.append({
                        "author_name": rev.get("author_name"),
                        "author_url": rev.get("author_url"),
                        "rating": rev.get("rating"),
                        "relative_time_description": rev.get("relative_time_description"),
                        "time": rev.get("time"),
                        "text": rev.get("text"),
                    })

                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "name": place_name,
                    "lat": el_latlon["lat"],
                    "lon": el_latlon["lon"],
                    "rating": rating,
                    "reviews": extracted_reviews,
                    "found_on_gmaps": True,
                })

            except Exception as e:
                logging.exception("Google Maps lookup failed for element %s", el.get("id"))
                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "name": search_name,
                    "lat": el_latlon["lat"],
                    "lon": el_latlon["lon"],
                    "rating": None,
                    "reviews": [],
                    "found_on_gmaps": False,
                    "error": str(e),
                })

        return {"gmap_results": results}

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Error while querying Overpass + Google Maps (GET /search/gmap)")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/search/gmap")
def search_overpass_with_gmap_post(
    payload: List[FrontendPolygonItem],
    amenity: str = Query("restaurant", description="Amenity to search for"),
    top_n: int = Query(3, description="How many top results to query Google Maps for (default 3)"),
    reviews_n: int = Query(2, description="How many reviews to return per place (default 2)")
):
    """
    Accept polygon payload, query Overpass and Google Maps for top N results, and return
    concise Google Maps summaries for up to `top_n` elements (name, lat, lon, rating, up to reviews_n reviews).
    """
    try:
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

        top_elements = elements[:top_n]
        results = []

        for el in top_elements:
            el_latlon = _get_latlon_from_element(el)
            tags = el.get("tags", {}) or {}
            if not el_latlon:
                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "skipped": True,
                    "reason": "no lat/lon or center available in element",
                })
                continue

            search_name = _build_search_name(tags)
            if not search_name:
                search_name = tags.get("amenity", "")

            try:
                details = call_gmaps(search_name, el_latlon["lat"], el_latlon["lon"], radius=100)
                if not details:
                    results.append({
                        "element_id": el.get("id"),
                        "osm_type": el.get("type"),
                        "name": search_name,
                        "lat": el_latlon["lat"],
                        "lon": el_latlon["lon"],
                        "rating": None,
                        "reviews": [],
                        "found_on_gmaps": False,
                    })
                    continue

                place_name = details.get("name") or search_name
                rating = details.get("rating")
                raw_reviews = details.get("reviews") or []
                extracted_reviews = []
                for rev in raw_reviews[:reviews_n]:
                    extracted_reviews.append({
                        "author_name": rev.get("author_name"),
                        "author_url": rev.get("author_url"),
                        "rating": rev.get("rating"),
                        "relative_time_description": rev.get("relative_time_description"),
                        "time": rev.get("time"),
                        "text": rev.get("text"),
                    })

                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "name": place_name,
                    "lat": el_latlon["lat"],
                    "lon": el_latlon["lon"],
                    "rating": rating,
                    "reviews": extracted_reviews,
                    "found_on_gmaps": True,
                })

            except Exception as e:
                logging.exception("Google Maps lookup failed for element %s", el.get("id"))
                results.append({
                    "element_id": el.get("id"),
                    "osm_type": el.get("type"),
                    "name": search_name,
                    "lat": el_latlon["lat"],
                    "lon": el_latlon["lon"],
                    "rating": None,
                    "reviews": [],
                    "found_on_gmaps": False,
                    "error": str(e),
                })

        return {"gmap_results": results}

    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Error while querying Overpass + Google Maps (POST /search/gmap)")
        raise HTTPException(status_code=500, detail=str(exc))
