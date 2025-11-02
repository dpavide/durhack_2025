"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
// Import LatLngExpression and L
import L, { LatLngExpression } from "leaflet";
// Import useMap
import { useMapEvents, useMap } from "react-leaflet";

// Client-only Leaflet components
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const FeatureGroup = dynamic(() => import("react-leaflet").then((m) => m.FeatureGroup), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });
const EditControl = dynamic(() => import("react-leaflet-draw").then((m) => m.EditControl), { ssr: false });
// Add Marker and Popup for LocationMarker
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });


type LatLon = { lat: number; lon: number };

// Thresholds
const WARN_THRESHOLD_KM2 = 5.0;
const MAX_THRESHOLD_KM2 = 5.0;

// Helpers: convert between positions and GeoJSON Polygon Feature
function positionsToGeoJSON(positions: LatLon[]) {
  if (!positions || positions.length < 3) return null;
  const ring = positions.map((p) => [p.lon, p.lat]);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push(ring[0]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

function geoJSONToPositions(geo: any): LatLon[] {
  try {
    if (!geo) return [];
    const geometry = geo.type === "Feature" ? geo.geometry : geo;
    if (!geometry || geometry.type !== "Polygon") return [];
    const ring = geometry.coordinates?.[0] ?? [];
    const coords =
      ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;
    return coords.map((c: [number, number]) => ({ lon: c[0], lat: c[1] }));
  } catch {
    return [];
  }
}

// Compute area (km^2) using turf.area — dynamic import to avoid SSR issues
// Cache the module so live-edit doesn't re-import on every vertex move.
let turfAreaFn: ((feature: any) => number) | null = null;
async function computeAreaKm2(latlngs: Array<{ lat: number; lon: number }>) {
  if (!latlngs || latlngs.length < 3) return 0;
  const coords = [latlngs.map((p) => [p.lon, p.lat])];
  const first = coords[0][0];
  const last = coords[0][coords[0].length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords[0].push(first);
  }
  if (!turfAreaFn) {
    const areaModule: any = await import("@turf/area");
    turfAreaFn = areaModule.default || areaModule;
  }
  if (!turfAreaFn) return 0; // Guard against null
  const areaMeters2: number = turfAreaFn({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: coords },
    properties: {},
  });
  return areaMeters2 / 1_000_000;
}

/* ---------------------------
   NEW: User Location Component
---------------------------- */

// Define the custom icon for user location
const userLocationIcon = new L.DivIcon({
  className: 'user-location-marker',
  html: '<div class="pulsating-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationMarker() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    // Try to fly to location on initial find
    navigator.geolocation.getCurrentPosition((pos) => {
      const latLng: LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
      setPosition(latLng);
      map.flyTo(latLng, 14); // Zoom to user's location
    }, () => {
      console.warn("User denied location access or error occurred.");
    });
    
    // Watch position for updates
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.warn(`Geolocation watch error: ${err.message}`);
      }
    );

    // Cleanup watcher on unmount
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={userLocationIcon}>
      <Popup>📍 You are here</Popup>
    </Marker>
  );
}


export default function MapPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [isClient, setIsClient] = useState(false);

  // Room + auth
  const [userId, setUserId] = useState<string | null>(null);
  const [masterId, setMasterId] = useState<string | null>(null);
  const isMaster = useMemo(() => !!userId && !!masterId && userId === masterId, [userId, masterId]);

  // Polygon state
  const [polygon, setPolygon] = useState<LatLon[]>([]);
  const fgRef = useRef<any>(null);
  const lastLayerRef = useRef<any>(null);
  const mapRef = useRef<any>(null); // live edit: keep map instance

  // Area + validation UI
  const [areaKm2, setAreaKm2] = useState<number | null>(null);
  const [polygonColor, setPolygonColor] = useState<string>("#2563eb");
  const [isValid, setIsValid] = useState<boolean>(true);
  const bannerVisible = areaKm2 !== null && areaKm2 > WARN_THRESHOLD_KM2;

  // Continue → backend
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  
  // NEW: State for merged intentions text
  const [allIntentionsText, setAllIntentionsText] = useState<string | null>(null); 

  // Debounced Supabase save (master only)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-only mount + Leaflet icon fix + force Leaflet-Draw to show km²
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== "undefined") {
      try {
        const L = require("leaflet");
        try {
          require("leaflet-draw");
        } catch (_) {
          // ignore
        }
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });

        if ((L as any).GeometryUtil && typeof (L as any).GeometryUtil.readableArea === "function") {
          const geom = (L as any).GeometryUtil;
          geom.readableArea = (area: number, _isMetric?: boolean, precision?: number) => {
            const km2 = area / 1_000_000;
            const prec = typeof precision === "number" ? precision : 4;
            return `${km2.toFixed(prec)} km²`;
          };
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Load session, room master and existing polygon
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const u = s.session?.user;
      if (!u) {
        router.replace("/");
        return;
      }
      setUserId(u.id);

      const { data: room, error } = await supabase
        .from("rooms")
        .select("master_id, polygon_geojson")
        .eq("room_code", code)
        .single();
      if (error || !room) {
        router.replace("/home");
        return;
      }
      setMasterId(room.master_id);
      setPolygon(geoJSONToPositions(room.polygon_geojson));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Realtime: listen for polygon updates
  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`map-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
        (payload) => {
          const poly = (payload.new as any)?.polygon_geojson ?? null;
          setPolygon(geoJSONToPositions(poly));
        }
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [code]);

  // Any time the polygon state changes (including from realtime), recompute area + validity + color
  useEffect(() => {
    (async () => {
      if (polygon.length >= 3) {
        const km2 = await computeAreaKm2(polygon);
        const rounded = Number(km2.toFixed(6));
        setAreaKm2(rounded);
        const color = km2 > WARN_THRESHOLD_KM2 ? "#ef4444" : "#2563eb";
        setPolygonColor(color);
        setIsValid(km2 <= MAX_THRESHOLD_KM2);
      } else {
        setAreaKm2(null);
        setIsValid(true);
        setPolygonColor("#2563eb");
      }
      setSendSuccess(false);
      setSendError(null);
      setAllIntentionsText(null); // Clear intentions when map changes
    })();
  }, [polygon]);

  const toJsonCoords = (latlngs: any[]) => latlngs.map((ll: any) => ({ lat: ll.lat, lon: ll.lng }));

  // Remove all polygon-like layers from the feature group except the edit control itself.
  const removeExistingPolygons = () => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      const layers = fg.getLayers ? fg.getLayers() : [];
      layers.forEach((lyr: any) => {
        if (lyr && typeof lyr.getLatLngs === "function") {
          fg.removeLayer(lyr);
        }
      });
    } catch {
      try {
        if (typeof fg.clearLayers === "function") fg.clearLayers();
      } catch {
        // ignore
      }
    }
  };

  // Master-only: save polygon to Supabase (debounced)
  const savePolygon = (positions: LatLon[]) => {
    if (!isMaster) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const feature = positionsToGeoJSON(positions);
      await supabase
        .from("rooms")
        .update({ polygon_geojson: feature })
        .eq("room_code", code)
        .eq("master_id", userId);
    }, 400);
  };

  // Fetch and merge all intentions for this room (used by Continue)
  const fetchAndDisplayIntentions = async (): Promise<string | null> => {
    setAllIntentionsText("Fetching intentions...");
    const { data: intentionsData, error } = await supabase
      .from("planning_intentions")
      .select("task_description, user_id, profiles:profiles!planning_intentions_user_id_fkey(username)")
      .eq("room_code", code);

    if (error) {
      console.error("Error fetching intentions:", error);
      setAllIntentionsText("Error fetching intentions. Check console for details.");
      return null;
    }
    if (!intentionsData || intentionsData.length === 0) {
      setAllIntentionsText("No planning intentions were submitted for this session.");
      return null;
    }

    const mergedText = intentionsData
      .map((item: any) => {
        const username = item.profiles?.username ?? `User ${item.user_id?.substring?.(0, 5) ?? "unknown"}`;
        return `${username}: ${item.task_description}`;
      })
      .join("\n");

    setAllIntentionsText(mergedText);
    return mergedText;
  };

  // Helpers to sync current editable polygon back to state (called during drag)
  const updatePolygonFromLayer = (layer: any) => {
    if (!layer || typeof layer.getLatLngs !== "function") return;
    const latlngs = layer.getLatLngs()?.[0] ?? [];
    if (!latlngs || latlngs.length < 3) return;
    const next = toJsonCoords(latlngs);
    setPolygon(next);
    savePolygon(next);
    lastLayerRef.current = layer;
  };

  const updatePolygonFromFG = () => {
    const fg = fgRef.current;
    if (!fg || !fg.getLayers) return;
    const layers = fg.getLayers();
    for (const lyr of layers) {
      if (lyr && typeof lyr.getLatLngs === "function") {
        updatePolygonFromLayer(lyr);
        break;
      }
    }
  };

  const liveEditHandler = (e: any) => {
    if (!isMaster) return;
    if (e?.layer && typeof e.layer.getLatLngs === "function") {
      updatePolygonFromLayer(e.layer);
      return;
    }
    if (e?.layers && typeof e.layers.eachLayer === "function") {
      let handled = false;
      e.layers.eachLayer((layer: any) => {
        if (!handled && layer && typeof layer.getLatLngs === "function") {
          updatePolygonFromLayer(layer);
          handled = true;
        }
      });
      if (handled) return;
    }
    if (lastLayerRef.current) {
      updatePolygonFromLayer(lastLayerRef.current);
      return;
    }
    updatePolygonFromFG();
  };

  // Attach live-edit listeners to the map so area/JSON update while dragging vertices.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaster) return;
    const handler = (e: any) => liveEditHandler(e);
    map.on("draw:editvertex", handler);
    map.on("draw:editmove", handler);
    map.on("draw:editresize", handler);
    return () => {
      map.off("draw:editvertex", handler);
      map.off("draw:editmove", handler);
      map.off("draw:editresize", handler);
    };
  }, [isMaster]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle create/edit/delete (master only)
  const handleCreated = async (e: any) => {
    if (!isMaster) return;
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      // ensure single polygon on map
      const fg = fgRef.current;
      if (fg && fg.getLayers) {
        try {
          const layers = fg.getLayers();
          layers.forEach((lyr: any) => {
            if (lyr !== layer && typeof lyr.getLatLngs === "function") {
              fg.removeLayer(lyr);
            }
          });
        } catch {
          try {
            if (typeof fg.clearLayers === "function") fg.clearLayers();
            if (typeof fg.addLayer === "function") fg.addLayer(layer);
          } catch {
            // ignore
          }
        }
      }

      const latlngs = layer.getLatLngs()[0];
      const next = toJsonCoords(latlngs);
      setPolygon(next);
      savePolygon(next);

      // live edit updates during drag
      layer.on("edit", () => {
        const updated = layer.getLatLngs()[0];
        const positions = toJsonCoords(updated);
        setPolygon(positions);
        savePolygon(positions);
      });

      lastLayerRef.current = layer;
    }
  };

  const handleEdited = async (e: any) => {
    if (!isMaster) return;
    const layers = e.layers;
    layers.eachLayer((layer: any) => {
      if (typeof layer.getLatLngs === "function") {
        const latlngs = layer.getLatLngs()[0];
        const next = toJsonCoords(latlngs);
        setPolygon(next);
        savePolygon(next);

        // ensure continuous updates in subsequent drags too
        layer.on("edit", () => {
          const updated = layer.getLatLngs()[0];
          const positions = toJsonCoords(updated);
          setPolygon(positions);
          savePolygon(positions);
        });

        lastLayerRef.current = layer;
      }
    });
  };

  const handleDeleted = () => {
    if (!isMaster) return;
    setPolygon([]);
    savePolygon([]);
    setAreaKm2(null);
    setIsValid(true);
    setPolygonColor("#2563eb");
    lastLayerRef.current = null;
    setSendSuccess(false);
    setSendError(null);
    setAllIntentionsText(null);
  };

  // Intercept the Leaflet Draw "delete" (bin/trash) to behave like clear (master only)
  useEffect(() => {
    if (!isClient || !isMaster) return;
    const clickHandler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement) || null;
      const deleteBtn = target?.closest(
        ".leaflet-draw-delete, .leaflet-draw-toolbar a.leaflet-draw-delete, .leaflet-draw-toolbar a[title='Delete layers']"
      ) as HTMLElement | null;

      if (!deleteBtn) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        removeExistingPolygons();
        handleDeleted();
      } catch {
        // ignore
      }
      return false;
    };
    document.addEventListener("click", clickHandler, true);
    return () => document.removeEventListener("click", clickHandler, true);
  }, [isClient, isMaster]); // only attach for master

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
        <div className="text-zinc-900 dark:text-zinc-100">Loading map... ⏳</div>
      </div>
    );
  }

  // Build payload for server: [{ lat, lng }, ...]
  const buildPayloadForServer = () => polygon.map((p) => ({ lat: p.lat, lng: p.lon }));

  const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

  const handleSendToBackend = async () => {
    if (!isMaster || polygon.length === 0 || !isValid) return;
    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);
    setAllIntentionsText(null);

    try {
      // 1. Send Polygon to Backend API (Existing Logic)
      const payload = buildPayloadForServer();
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/map/set_sample` : "/api/map/set_sample";

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        setSendError(`Server returned ${resp.status}: ${text}`);
        setIsSending(false);
        return;
      }

      await resp.json();
      
      // 2. NEW: Fetch intentions and POST them to the gemini endpoint
      const mergedText = await fetchAndDisplayIntentions();

      if (mergedText) {
        try {
          const promptUrl =
            BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/gemini/set_prompt` : "/api/gemini/set_prompt";

          const promptResp = await fetch(promptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: mergedText }),
          });

          if (!promptResp.ok) {
            const txt = await promptResp.text().catch(() => "");
            setSendError(`Failed to save USER_PROMPT: ${promptResp.status} ${txt}`);
            setIsSending(false);
            return;
          }
        } catch (err: any) {
          console.error("Error posting prompt to backend:", err);
          setSendError(String(err));
          setIsSending(false);
          return;
        }
      }
      
      setIsSending(false);
      setSendSuccess(true); // Set success before navigating

      // 3. **NAVIGATE** to the map-places page. That page will call GET /api/map/search on mount and render the markers.
      //    This correctly uses the dynamic route path.
      router.push(`/map-places/${code}`);
    } catch (err: any) {
      setIsSending(false);
      setSendError(String(err));
    }
  };

  const polygonCount = polygon.length > 0 ? 1 : 0;
  const areaText = areaKm2 === null ? "—" : `${areaKm2.toFixed(4)} km²`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-6">
      {/* NEW: CSS for the user location marker */}
      <style>{`
        @keyframes pulsate {
          0% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(0, 128, 255, 0.7);
          }
          70% {
            transform: scale(1.5);
            opacity: 0;
            box-shadow: 0 0 0 10px rgba(0, 128, 255, 0);
          }
          100% {
            transform: scale(1);
            opacity: 0;
            box-shadow: 0 0 0 0 rgba(0, 128, 255, 0);
          }
        }
        .pulsating-dot {
          width: 16px;
          height: 16px;
          background-color: #007bff;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 0 0 rgba(0, 128, 255, 0.7);
          animation: pulsate 2s infinite;
        }
        .user-location-marker .pulsating-dot {
          // Leaflet DivIcon centers this element
        }
      `}</style>

      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Select Area on Map 🗺️
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Area:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{areaText}</span>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Polygons:{" "}
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/5 text-zinc-900 dark:text-zinc-100">
                  {polygonCount}/1
                </span>
              </div>
              {!isMaster && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  View-only mode — only the room owner can edit.
                </div>
              )}
            </div>
          </div>

          <Link href="/user-info" className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline">
            Back to user info
          </Link>
        </div>

        {/* Banner shown when above warn threshold */}
        {bannerVisible && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200">
            The polygon you've selected is too large, please shrink it to continue!
          </div>
        )}

        <div className="w-full h-[70vh] rounded-lg border border-black/[.08] dark:border-white/[.145] shadow-md overflow-hidden">
          <MapContainer
            center={[54.7761, -1.5754]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            ref={(instance: any) => {
              if (instance) {
                mapRef.current = instance;
              }
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
              maxZoom={19}
            />
            <FeatureGroup ref={(ref: any) => (fgRef.current = ref && (ref.leafletElement ?? ref))}>
              {isMaster && (
                <EditControl
                  position="topright"
                  onCreated={handleCreated}
                  onEdited={handleEdited}
                  onDeleted={handleDeleted}
                  // Live edit: update continuously while dragging vertices/handles (if supported by wrapper)
                  onEditVertex={liveEditHandler}
                  onEditMove={liveEditHandler}
                  onEditResize={liveEditHandler}
                  draw={{
                    rectangle: false,
                    circle: false,
                    marker: false,
                    circlemarker: false,
                    polyline: false,
                    polygon: {
                      allowIntersection: false,
                      showArea: true,
                      shapeOptions: { color: "#2563eb" },
                    },
                  }}
                  edit={{ edit: true, remove: true }}
                />
              )}
              {polygon.length > 0 && (
                <Polygon positions={polygon.map((p) => [p.lat, p.lon]) as any} pathOptions={{ color: polygonColor }} />
              )}
            </FeatureGroup>
            
            {/* NEW: Add the user location marker component */}
            <LocationMarker />
          </MapContainer>
        </div>

        <div className="mt-4 flex items-start gap-4">
          {/* Continue button is MASTER-ONLY */}
          {isMaster && (
            <button
              onClick={handleSendToBackend}
              disabled={polygon.length === 0 || !isValid || isSending}
              className={`px-4 py-2 rounded-md font-medium shadow-sm text-white ${
                polygon.length === 0 || !isValid || isSending ? "bg-zinc-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSending ? "Sending... ⏳" : "Continue ➡️"}
            </button>
          )}

          <div className="flex-1">
            {sendSuccess && (
              <div className="text-sm text-green-700 dark:text-green-300">
                Polygon saved and intentions sent. Redirecting... ✅
              </div>
            )}
            {sendError && (
              <div className="text-sm text-red-700 dark:text-red-300">
                Error: {sendError} ❌
              </div>
            )}

            {/* Merged Intentions Text */}
            {allIntentionsText !== null && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Session Planning Intentions
                </h3>
                <pre className="p-4 bg-white dark:bg-zinc-900 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                    {allIntentionsText}
                </pre>
              </div>
            )}

            {/* JSON visible only when valid */}
            {polygon.length > 0 && isValid && (
              <div className="mt-2">
                <pre className="p-4 bg-white dark:bg-zinc-900 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm overflow-x-auto text-zinc-900 dark:text-zinc-100">
                  {JSON.stringify(polygon, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Area is measured in <span className="font-medium">square kilometres (km²)</span>. Polygons larger than{" "}
                  {WARN_THRESHOLD_KM2} km² will show a warning and turn red. Polygons larger than {MAX_THRESHOLD_KM2} km² are{" "}
                  <span className="font-medium">invalid</span> and their JSON coordinates will not be shown or sent.
                </div>
              </div>
            )}

            {/* If polygon exists but invalid, explain why JSON is hidden */}
            {polygon.length > 0 && !isValid && (
              <div className="mt-2 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100 text-sm">
                This polygon is larger than {MAX_THRESHOLD_KM2} km² and therefore its coordinates are not available here. Please
                shrink it to see and use the JSON coordinates.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

