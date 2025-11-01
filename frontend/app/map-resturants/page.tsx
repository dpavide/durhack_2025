"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// --- Dynamic imports to avoid SSR "window is not defined" ---
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
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

// ---- Types ----
type PinnedPoint = {
  id: string; // uuid
  lat: number;
  lon: number;
  name?: string;
  website?: string;
  tags?: Record<string, string>;
};

const LS_KEY = "pinned_points_v1";

export default function MapPinPage() {
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinnedPoint[]>([]);

  // Basic Leaflet default icon
  const icon = useMemo(
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

  // Load saved pins
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setPins(JSON.parse(raw));
    } catch {}
  }, []);

  // Save pins whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pins));
    } catch {}
  }, [pins]);

  // Handle map click while in pin mode
  const handleMapClick = async (e: any) => {
    if (!pinMode) return;
    const { lat, lng } = e.latlng;

    // Quick, hackathon-friendly input prompts.
    // (You can replace with a modal form later.)
    const name = window.prompt("Name for this place? (optional)") || undefined;
    const website =
      window.prompt("Website URL? (optional)") || undefined;

    // Simple freeform tags input: key=value per line (optional)
    const tagsInput =
      window.prompt(
        "Extra tags? (optional)\nEnter lines like:\naddr:street=Navigation Street\namenity=restaurant"
      ) || "";

    const tags: Record<string, string> | undefined =
      tagsInput.trim().length
        ? Object.fromEntries(
            tagsInput
              .split("\n")
              .map((line) => line.split("=").map((s) => s.trim()))
              .filter((kv) => kv.length === 2)
          )
        : undefined;

    const newPin: PinnedPoint = {
      id: crypto.randomUUID(),
      lat,
      lon: lng,
      name,
      website,
      tags,
    };
    setPins((prev) => [...prev, newPin]);
  };

  // Load an example JSON and add its points as pins (optional helper)
  const loadFromJson = async () => {
    try {
      const res = await fetch("/api/restaurants.json");
      const data = await res.json();
      if (!data?.elements) return;

      const jsonPins: PinnedPoint[] = data.elements.map((el: any) => ({
        id: String(el.id),
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name,
        website: el.tags?.website,
        tags: el.tags,
      }));

      setPins((prev) => {
        // avoid duplicates by id
        const existing = new Set(prev.map((p) => p.id));
        const merged = [...prev, ...jsonPins.filter((p) => !existing.has(p.id))];
        return merged;
      });
      alert("Loaded points from JSON!");
    } catch (e) {
      console.error(e);
      alert("Failed to load /api/restaurants.json");
    }
  };

  // Remove a pin by id
  const removePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">
            Pin Points on Map
          </h1>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                pinMode
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
              }`}
              onClick={() => setPinMode((v) => !v)}
              title="Toggle pin mode — click on map to add a marker"
            >
              {pinMode ? "Pin mode: ON" : "Pin mode: OFF"}
            </button>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={loadFromJson}
              title="Load markers from /api/restaurants.json"
            >
              Load from JSON
            </button>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (confirm("Clear all saved pins?")) setPins([]);
              }}
              title="Remove all saved pins"
            >
              Clear pins
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="w-full h-[78vh] rounded-xl shadow overflow-hidden">
          <MapContainer
            center={[52.48, -1.9]} // Birmingham as a nice default
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            // react-leaflet 'whenCreated' exposes raw leaflet map to register click
            whenCreated={(map) => {
              map.on("click", handleMapClick);
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
            />

            {/* Render saved pins */}
            {pins.map((p) => (
              <Marker
                key={p.id}
                position={[p.lat, p.lon]}
                icon={icon}
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

                    {/* Tags like the OSM inspector style */}
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

                    {/* Website link if present */}
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

                    <div className="mt-2">
                      <button
                        className="px-3 py-1 rounded-full text-xs bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => removePin(p.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <p className="text-xs text-zinc-500 mt-2">
          Tip: Toggle <strong>Pin mode</strong>, then click on the map to drop a
          marker. You can also load your provided JSON via the button.
        </p>
      </div>
    </div>
  );
}
