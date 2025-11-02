"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import { useMapEvents } from "react-leaflet";
import type { ComponentType } from "react";

/* ---------------------------
   Dynamic imports (SSR-safe)
---------------------------- */
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const FeatureGroup = dynamic(
  () => import("react-leaflet").then((m) => m.FeatureGroup),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((m) => m.Polygon),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);
// react-leaflet-draw doesn't ship great TS types for the EditControl when dynamically imported.
// Force a loose component type so typical props like `position` are accepted by TS.
const EditControl = (dynamic(
  () => import("react-leaflet-draw").then((m: any) => m.EditControl),
  { ssr: false }
) as unknown) as ComponentType<any>;

/* ---------------------------
   Types
--------------------------- */
type Pin = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  website?: string;
  tags?: Record<string, string>;
  source?: "json" | "user";
};

const LS_KEY = "map_pins_v1";
const MAX_API_PINS = 10; // <-- change only here if you want a different limit

/* ---------------------------
   Helper: sample up to N elements without replacement
   Uses Fisher-Yates shuffle to avoid duplicates.
---------------------------- */
function sampleUpTo<T>(arr: T[], n: number): T[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const copy = arr.slice();
  // Fisher-Yates shuffle until we've moved n items to the front
  const len = copy.length;
  const take = Math.min(n, len);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, take);
}

/* ---------------------------
   Listen to map clicks (for user pins)
--------------------------- */
function ClickBinder({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPage() {
  const [polygon, setPolygon] = useState<any[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const markerIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -36],
      }),
    []
  );

  // Load local user pins from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const saved: Pin[] = JSON.parse(raw).filter((p: Pin) => p.source === "user");
      setPins((curr) => [...curr, ...saved]);
    } catch {
      // ignore parse errors
    }
  }, []);

  // persist user pins only
  useEffect(() => {
    const onlyUser = pins.filter((p) => p.source === "user");
    localStorage.setItem(LS_KEY, JSON.stringify(onlyUser));
  }, [pins]);

  const addPin = (lat: number, lng: number) => {
    const name = window.prompt("Name (optional)") || undefined;
    const website = window.prompt("Website (optional)") || undefined;
    const tagsInput =
      window.prompt(
        "Extra tags (optional):\nkey=value per line\n(e.g. amenity=restaurant)"
      ) || "";

    const tags =
      tagsInput.trim().length
        ? Object.fromEntries(
            tagsInput
              .split("\n")
              .map((line) => line.split("=").map((s) => s.trim()))
              .filter((kv) => kv.length === 2)
          )
        : undefined;

    setPins((prev) => [
      ...prev,
      { id: crypto.randomUUID(), lat, lon: lng, name, website, tags, source: "user" },
    ]);
  };

  const clearUserPins = () => {
    if (confirm("Clear user pins (keeps API pins)?")) {
      const keepJson = pins.filter((p) => p.source === "json");
      setPins(keepJson);
      localStorage.removeItem(LS_KEY);
    }
  };

  // NEW: Fetch markers from backend GET /api/map/search
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/map/search` : "/api/map/search";

      try {
        const resp = await fetch(url, { method: "GET" });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          throw new Error(`Server returned ${resp.status}: ${txt}`);
        }
        const data = await resp.json();

        // Expecting OSM-like shape: { elements: [ {type, id, lat, lon, tags: {...}} ] }
        const elements = Array.isArray(data?.elements) ? data.elements : [];

        // Keep only elements with coordinates
        const withCoords = elements.filter((el: any) => typeof el.lat === "number" && typeof el.lon === "number");

        // Sample up to MAX_API_PINS random elements (no duplicates). If elements < MAX_API_PINS we take all.
        const sampled = sampleUpTo(withCoords, MAX_API_PINS);

        const fromApi: Pin[] = sampled.map((el: any) => ({
          id: String(el.id ?? `${el.type ?? "node"}_${Math.random().toString(36).slice(2, 8)}`),
          lat: el.lat,
          lon: el.lon,
          name: el.tags?.name,
          website: el.tags?.website,
          tags: el.tags,
          source: "json",
        }));

        // Merge: keep existing user pins (source=user) and add API pins
        setPins((existing) => {
          const userPins = existing.filter((p) => p.source === "user");
          return [...fromApi, ...userPins];
        });
      } catch (err: any) {
        console.error("Error fetching /api/map/search:", err);
        setLoadError(String(err?.message ?? err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep UI smooth by applying Leaflet icon fix (like your other page)
  useEffect(() => {
    try {
      const Lpkg = require("leaflet");
      delete (Lpkg.Icon.Default.prototype as any)._getIconUrl;
      Lpkg.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    } catch {
      // ignore when SSR or unavailable
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Map Results</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Results from the latest search. Click markers to inspect details.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${pinMode ? "bg-emerald-600 text-white" : "bg-zinc-200 hover:bg-zinc-300"}`}
              onClick={() => setPinMode((v) => !v)}
              title="Toggle pin mode. When ON, click the map to drop a marker."
            >
              {pinMode ? "Pin mode: ON" : "Pin mode: OFF"}
            </button>

            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
              onClick={clearUserPins}
            >
              Clear user pins
            </button>
          </div>
        </div>

        <div className="w-full h-[70vh] rounded-lg border border-black/[.08] dark:border-white/[.145] shadow-md overflow-hidden relative">
          <MapContainer
            // Center changed to Durham, UK (lat, lon)
            center={[54.7753, -1.5840]}
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
              maxZoom={19}
            />

            <ClickBinder enabled={pinMode} onClick={addPin} />

            <FeatureGroup>
              {polygon.length > 0 && <Polygon positions={polygon as any} color="#2563eb" />}
            </FeatureGroup>

            {/* Render both API pins + user pins */}
            {pins.map((p) => {
              const tagEntries = Object.entries(p.tags || {});
              const tagCount = tagEntries.length;

              return (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lon]}
                  icon={markerIcon}
                  eventHandlers={{
                    mouseover: (e) => e.target.openPopup(),
                    mouseout: (e) => e.target.closePopup(),
                  }}
                >
                  <Popup>
                    <div className="text-sm leading-5">
                      <p className="text-xl font-extrabold">
                        Node{" "}
                        <a
                          href={`https://www.openstreetmap.org/node/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 underline"
                        >
                          {p.id}
                        </a>{" "}—
                      </p>

                      <p className="mt-2 text-lg font-bold">
                        Tags <span className="ml-2 text-indigo-600 font-semibold">{tagCount}</span>
                      </p>

                      <div className="font-mono whitespace-pre-wrap">
                        {tagEntries.map(([k, v]) => (
                          <div key={k}>
                            {k} = {String(v)}
                          </div>
                        ))}
                      </div>

                      {p.website && (
                        <div className="mt-2">
                          <a
                            className="text-blue-600 underline break-all"
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {p.website}
                          </a>
                        </div>
                      )}

                      <p className="mt-3 text-2xl font-bold">Coordinates</p>
                      <p className="text-sky-700 font-semibold">
                        {p.lat.toFixed(6)} / {p.lon.toFixed(6)} <span className="text-zinc-600 text-xs">(lat/lon)</span>
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Loading / error overlays (styled like your working page) */}
          {loading && (
            <div className="absolute left-4 right-4 top-4 flex justify-center pointer-events-none">
              <div className="inline-block px-4 py-2 bg-white rounded shadow">Loading markers…</div>
            </div>
          )}
          {loadError && (
            <div className="absolute left-4 right-4 top-4 flex justify-center pointer-events-auto">
              <div className="inline-block px-4 py-2 bg-red-50 text-red-800 rounded border border-red-200">
                Error loading markers: {loadError}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Showing <span className="font-medium">{pins.length}</span> markers (up to {MAX_API_PINS} from API + any user pins).
          </div>
        </div>
      </div>
    </div>
  );
}
