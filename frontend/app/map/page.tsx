"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Leaflet/react-leaflet must be loaded client-side only
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const FeatureGroup = dynamic(
  () => import("react-leaflet").then((mod) => mod.FeatureGroup),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const EditControl = dynamic(
  () => import("react-leaflet-draw").then((mod) => mod.EditControl),
  { ssr: false }
);

export default function MapPage() {
  // polygon stored as array of { lat, lon } — kept for rendering & (optionally) JSON
  const [polygon, setPolygon] = useState<Array<{ lat: number; lon: number }>>(
    []
  );
  const [isClient, setIsClient] = useState(false);

  // area in km^2
  const [areaKm2, setAreaKm2] = useState<number | null>(null);

  // polygon color (changes to red when above warn threshold)
  const [polygonColor, setPolygonColor] = useState<string>("#2563eb");

  // whether current polygon is valid (<= MAX_THRESHOLD_KM2). If invalid, we won't show JSON.
  const [isValid, setIsValid] = useState<boolean>(true);

  // thresholds
  const WARN_THRESHOLD_KM2 = 5.0; // <-- changed: no warning / red until > 5.0 km²
  const MAX_THRESHOLD_KM2 = 5.0; // polygons > 5.0 km² are invalid (no JSON)

  // banner visible when above warn threshold
  const bannerVisible = areaKm2 !== null && areaKm2 > WARN_THRESHOLD_KM2;

  // FeatureGroup ref to manage layers (remove previous polygon when adding a new one)
  const fgRef = useRef<any>(null);

  // Keep a reference to the last drawn layer so we can re-style it on edits if needed
  const lastLayerRef = useRef<any>(null);

  // sending state for Continue button
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
    // Fix Leaflet icon paths (client-only) and force Leaflet-Draw to display area in km²
    if (typeof window !== "undefined") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const L = require("leaflet");
        // ensure leaflet-draw is loaded so GeometryUtil exists
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("leaflet-draw");
        } catch (err) {
          // leaflet-draw may already be imported via the EditControl; ignore if require fails
        }

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });

        // Patch Leaflet.Draw's readableArea function so it always shows km²
        // (Leaflet.Draw uses L.GeometryUtil.readableArea(area, isMetric, precision))
        if ((L as any).GeometryUtil && typeof (L as any).GeometryUtil.readableArea === "function") {
          const geom = (L as any).GeometryUtil;
          geom.readableArea = (area: number, isMetric?: boolean, precision?: number) => {
            // area is in square meters. Convert to km^2 and format.
            const km2 = area / 1_000_000;
            // default precision handling similar to draw's behavior
            const prec = typeof precision === "number" ? precision : 4;
            return `${km2.toFixed(prec)} km²`;
          };
        }
      } catch (err) {
        // If anything goes wrong patching leaflet, ignore — map will still work.
      }
    }
  }, []);

  const toJsonCoords = (latlngs: any[]) =>
    latlngs.map((ll: any) => ({ lat: ll.lat, lon: ll.lng }));

  // Compute area (km^2) using turf.area — dynamic import so it doesn't get pulled into SSR
  const computeAreaKm2 = async (latlngs: Array<{ lat: number; lon: number }>) => {
    if (!latlngs || latlngs.length < 3) return 0;
    // build GeoJSON polygon: coordinates must be [lng, lat]
    const coords = [latlngs.map((p) => [p.lon, p.lat])];
    // ensure closed
    const first = coords[0][0];
    const last = coords[0][coords[0].length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords[0].push(first);
    }
    const areaModule: any = await import("@turf/area");
    const areaMeters2: number = areaModule.default({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: coords,
      },
      properties: {},
    });
    const km2 = areaMeters2 / 1_000_000;
    return km2;
  };

  /**
   * Process latlngs from a layer:
   * - compute area
   * - set areaKm2
   * - set polygonColor (red if > WARN_THRESHOLD)
   * - set isValid (true if <= MAX_THRESHOLD)
   * - setPolygon (so polygon renders on map)
   *
   * IMPORTANT: This function DOES NOT remove the drawn layer. We allow drawing of any size.
   */
  const processLayerLatLngs = async (latlngsRaw: any[], layer?: any) => {
    const latlngs = latlngsRaw.map((ll: any) => ({ lat: ll.lat, lon: ll.lng }));
    const km2 = await computeAreaKm2(latlngs);
    setAreaKm2(Number(km2.toFixed(6)));

    // color: red if above warn threshold, otherwise blue
    const color = km2 > WARN_THRESHOLD_KM2 ? "#ef4444" : "#2563eb";
    setPolygonColor(color);

    // valid if <= MAX_THRESHOLD
    const valid = km2 <= MAX_THRESHOLD_KM2;
    setIsValid(valid);

    // update layer style if provided
    try {
      if (layer && typeof layer.setStyle === "function") {
        layer.setStyle({ color });
      }
    } catch (err) {
      // ignore
    }

    // Always set polygon state so the shape remains visible on the map.
    // We'll only display JSON when `isValid` is true.
    setPolygon(latlngs);

    // store last layer ref so edits can style it later
    if (layer) {
      lastLayerRef.current = layer;
    }

    // Reset send state (user changed polygon after previous save)
    setSendSuccess(false);
    setSendError(null);
  };

  // Remove all polygon-like layers from the feature group except the edit control itself.
  // When we add a new polygon, we call this to ensure only one polygon exists.
  const removeExistingPolygons = () => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      const layers = fg.getLayers ? fg.getLayers() : [];
      layers.forEach((lyr: any) => {
        // The EditControl is not part of FeatureGroup layers, but just in case,
        // only remove layers that look like vector layers (have getLatLngs)
        if (lyr && typeof lyr.getLatLngs === "function") {
          fg.removeLayer(lyr);
        }
      });
    } catch (err) {
      // fallback: try clearLayers (may or may not remove controls)
      try {
        if (typeof fg.clearLayers === "function") fg.clearLayers();
      } catch (e) {
        // ignore
      }
    }
  };

  // Called when user creates a new shape
  const handleCreated = async (e: any) => {
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      // Ensure only one polygon: remove others (but keep the new layer)
      const fg = fgRef.current;
      if (fg && fg.getLayers) {
        try {
          const layers = fg.getLayers();
          layers.forEach((lyr: any) => {
            if (lyr !== layer && typeof lyr.getLatLngs === "function") {
              fg.removeLayer(lyr);
            }
          });
        } catch (err) {
          // if something goes wrong, attempt a full clear then re-add the created layer
          try {
            if (typeof fg.clearLayers === "function") fg.clearLayers();
            if (typeof fg.addLayer === "function") fg.addLayer(layer);
          } catch (e) {
            // ignore
          }
        }
      }

      const latlngs = layer.getLatLngs()[0];
      await processLayerLatLngs(latlngs, layer);

      // Attach live edit listener for future edits (keeps real-time updates while editing)
      layer.on("edit", async () => {
        const updated = layer.getLatLngs()[0];
        await processLayerLatLngs(updated, layer);
      });
    }
  };

  // Called when user finishes editing shapes
  const handleEdited = async (e: any) => {
    // Leaflet's LayerGroup provides a layers object that we iterate
    const layersObj = e.layers;
    // collect layers into array and process sequentially so async works predictably
    const layersArray: any[] = [];
    layersObj.eachLayer((layer: any) => layersArray.push(layer));
    for (const layer of layersArray) {
      if (typeof layer.getLatLngs === "function") {
        const latlngs = layer.getLatLngs()[0];
        await processLayerLatLngs(latlngs, layer);
      }
    }
  };

  const handleDeleted = (e?: any) => {
    // If the user deleted the polygon via the draw controls, clear state
    setPolygon([]);
    setAreaKm2(null);
    setIsValid(true);
    setPolygonColor("#2563eb");
    lastLayerRef.current = null;

    // Reset send state
    setSendSuccess(false);
    setSendError(null);
  };

  // NEW EFFECT:
  // Intercept clicks on the Leaflet Draw "delete" (bin/trash) button and make it
  // immediately clear all drawn polygons (behaves like your "clear" action).
  useEffect(() => {
    if (!isClient) return;

    const clickHandler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement) || null;
      const deleteBtn = target?.closest(
        ".leaflet-draw-delete, .leaflet-draw-toolbar a.leaflet-draw-delete, .leaflet-draw-toolbar a[title='Delete layers']"
      ) as HTMLElement | null;

      if (!deleteBtn) return; // not a delete-bin click

      // Prevent the draw plugin from entering "delete" mode and toggling selection UI.
      e.preventDefault();
      e.stopPropagation();

      // Perform the immediate clear behavior (same as clicking "clear")
      try {
        removeExistingPolygons();
        handleDeleted();
      } catch (err) {
        // ignore - we still want to prevent default behaviour
      }

      return false;
    };

    // capture-phase to intercept before leaflet-draw toggles UI state
    document.addEventListener("click", clickHandler, true);

    return () => {
      document.removeEventListener("click", clickHandler, true);
    };
  }, [isClient]);

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
        <div className="text-zinc-900 dark:text-zinc-100">Loading map...</div>
      </div>
    );
  }

  // Convert internal polygon [{lat, lon}] to the simple JSON shape we send to the server:
  // [{ lat: <number>, lng: <number> }, ...]
  const buildPayloadForServer = () =>
    polygon.map((p) => ({ lat: p.lat, lng: p.lon }));

  // BACKEND base from env. If not set, frontend will attempt relative path (useful if reverse-proxied)
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(
    /\/$/,
    ""
  );

  // Send the polygon JSON to the backend when the user clicks "Continue"
  const handleSendToBackend = async () => {
    if (polygon.length === 0 || !isValid) return;
    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const payload = buildPayloadForServer();

      // Important: your FastAPI main mounts the router with prefix "/api/map"
      const url =
        BACKEND_BASE !== ""
          ? `${BACKEND_BASE}/api/map/set_sample`
          : "/api/map/set_sample";

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        setSendError(`Server returned ${resp.status}: ${text}`);
        setIsSending(false);
        return;
      }

      const json = await resp.json();
      setIsSending(false);
      setSendSuccess(true);
      console.log("Server response from set_sample:", json);
    } catch (err: any) {
      setIsSending(false);
      setSendError(String(err));
    }
  };

  // polygon count (0 or 1)
  const polygonCount = polygon.length > 0 ? 1 : 0;

  // top area text (we still show area even if invalid; the JSON block below is hidden when invalid)
  const areaText = areaKm2 === null ? "—" : `${areaKm2.toFixed(4)} km²`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Select Area on Map
            </h1>
            <div className="mt-1 flex items-center gap-4">
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Area:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {areaText}
                </span>
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Polygons:{" "}
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/5 text-zinc-900 dark:text-zinc-100">
                  {polygonCount}/1
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/user-info"
            className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline"
          >
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
            center={[24.4539, 54.3773]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
              maxZoom={19}
            />
            <FeatureGroup
              ref={(ref: any) =>
                (fgRef.current = ref && (ref.leafletElement ?? ref))
              }
            >
              <EditControl
                position="topright"
                onCreated={handleCreated}
                onEdited={handleEdited}
                onDeleted={handleDeleted}
                draw={{
                  rectangle: false,
                  circle: false,
                  marker: false,
                  circlemarker: false,
                  polyline: false,
                  polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: { color: "#2563eb" }, // default drawing color
                  },
                }}
              />
              {/* Show the polygon controlled by React state (color reflects warning) */}
              {polygon.length > 0 && (
                <Polygon
                  positions={polygon.map((p) => [p.lat, p.lon]) as any}
                  pathOptions={{ color: polygonColor }}
                />
              )}
            </FeatureGroup>
          </MapContainer>
        </div>

        {/* Continue button + send status */}
        <div className="mt-4 flex items-start gap-4">
          <button
            onClick={handleSendToBackend}
            disabled={polygon.length === 0 || !isValid || isSending}
            className={`px-4 py-2 rounded-md font-medium shadow-sm text-white ${
              polygon.length === 0 || !isValid || isSending
                ? "bg-zinc-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSending ? "Sending..." : "Continue"}
          </button>

          <div className="flex-1">
            {sendSuccess && (
              <div className="text-sm text-green-700 dark:text-green-300">
                Polygon saved to server SAMPLE_DATA.
              </div>
            )}
            {sendError && (
              <div className="text-sm text-red-700 dark:text-red-300">
                Error saving polygon: {sendError}
              </div>
            )}

            {/* JSON and small explanatory note — JSON is shown only when valid */}
            {polygon.length > 0 && isValid && (
              <div className="mt-2">
                <pre className="p-4 bg-white dark:bg-zinc-900 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm overflow-x-auto text-zinc-900 dark:text-zinc-100">
                  {JSON.stringify(polygon, null, 2)}
                </pre>
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Area is measured in{" "}
                  <span className="font-medium">square kilometres (km²)</span>. Polygons
                  larger than {WARN_THRESHOLD_KM2} km² will show a warning and turn
                  red. Polygons larger than {MAX_THRESHOLD_KM2} km² are considered{" "}
                  <span className="font-medium">invalid</span> and their JSON
                  coordinates will not be shown or sent.
                </div>
              </div>
            )}

            {/* If polygon exists but invalid, explain why JSON is hidden */}
            {polygon.length > 0 && !isValid && (
              <div className="mt-2 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100 text-sm">
                This polygon is larger than {MAX_THRESHOLD_KM2} km² and therefore its
                coordinates are not available here. Please shrink it to see and use
                the JSON coordinates.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
