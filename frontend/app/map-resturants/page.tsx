"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import { useMapEvents } from "react-leaflet";

// dynamic imports to avoid SSR issues
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
// react-leaflet-draw control
const EditControl = dynamic(
  // @ts-ignore
  () => import("react-leaflet-draw").then((m: any) => m.EditControl),
  { ssr: false }
);

type Pin = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  website?: string;
  tags?: Record<string, string>;
};

const LS_KEY = "map_pins_v1";

/** v4 way to listen to clicks */
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

  const markerIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -36],
      }),
    []
  );

  // restore/save pins
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) setPins(JSON.parse(raw));
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(pins));
  }, [pins]);

  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      const coords = layer.getLatLngs()[0].map((latlng: any) => [
        latlng.lat,
        latlng.lng,
      ]);
      setPolygon(coords);
    }
  };

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
      { id: crypto.randomUUID(), lat, lon: lng, name, website, tags },
    ]);
  };

  const loadFromJson = async () => {
    try {
      const res = await fetch("/api/restaurants.json");
      const data = await res.json();
      if (!data?.elements) return;
      const imported: Pin[] = data.elements.map((el: any) => ({
        id: String(el.id),
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name,
        website: el.tags?.website,
        tags: el.tags,
      }));
      const existing = new Set(pins.map((p) => p.id));
      setPins((prev) => [...prev, ...imported.filter((p) => !existing.has(p.id))]);
      alert("Loaded markers from JSON");
    } catch {
      alert("Failed to load /api/restaurants.json");
    }
  };

  const clearPins = () => {
    if (confirm("Clear all pins?")) setPins([]);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header with the BUTTONS you asked for */}
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Select Area on Map</h1>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              pinMode
                ? "bg-emerald-600 text-white"
                : "bg-zinc-200 hover:bg-zinc-300"
            }`}
            onClick={() => setPinMode((v) => !v)}
            title="Toggle pin mode. When ON, click the map to drop a marker."
          >
            {pinMode ? "Pin mode: ON" : "Pin mode: OFF"}
          </button>
          <button
            className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={loadFromJson}
          >
            Load from JSON
          </button>
          <button
            className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
            onClick={clearPins}
          >
            Clear pins
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="w-full h-[78vh] rounded-xl shadow overflow-hidden">
          <MapContainer
            center={[53.5, -1.5]}
            zoom={7}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
            />

            {/* Clicks handled here when pinMode is ON */}
            <ClickBinder enabled={pinMode} onClick={addPin} />

            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handleCreated}
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
              />
              {polygon.length > 0 && (
                <Polygon positions={polygon} color="#2563eb" />
              )}
            </FeatureGroup>

            {/* Render user pins (open popup on hover) */}
            {pins.map((p) => (
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
                    <p className="text-lg font-bold mb-1">
                      {p.name || "Pinned point"}
                    </p>
                    <p className="text-zinc-600 -mt-1 mb-2">
                      {p.lat.toFixed(6)}, {p.lon.toFixed(6)} (lat/lon)
                    </p>
                    {p.tags && (
                      <>
                        <p className="font-semibold">Tags</p>
                        <ul className="mb-2">
                          {Object.entries(p.tags).map(([k, v]) => (
                            <li key={k}>
                              <strong>{k}</strong> = {String(v)}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {p.website && (
                      <p className="truncate">
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline break-all"
                        >
                          {p.website}
                        </a>
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}