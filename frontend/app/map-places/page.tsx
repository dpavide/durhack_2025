// frontend/app/map-places/page.tsx

"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

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
   Types & Constants
---------------------------- */
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
const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

/* ---------------------------
   Listen to map clicks (for user pins)
---------------------------- */
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

/* ---------------------------
   Hardcoded JSON (your data)
---------------------------- */
const OSM_DATA = {
  elements: [
    {
      type: "node",
      id: 245554603,
      lat: 52.4782744,
      lon: -1.9126816,
      tags: {
        "addr:city": "Birmingham",
        "addr:postcode": "B1 2HL",
        "addr:street": "The Waters Edge",
        amenity: "restaurant",
        brand: "Las Iguanas",
        "brand:wikidata": "Q19875012",
        "brand:wikipedia": "en:Las Iguanas",
        check_date: "2024-07-16",
        "check_date:opening_hours": "2024-07-16",
        cuisine: "Latin American",
        "fhrs:id": "1315589",
        name: "Las Iguanas",
        opening_hours:
          "Mo-Tu 11:00-21:30; We-Th 11:00-22:00; Fr-Sa 11:00-22:30; Su 11:00-21:30",
        source: "local knowledge",
        website:
          "https://www.iguanas.co.uk/restaurants/birmingham-brindley-place/",
      },
    },
    {
      type: "node",
      id: 310674206,
      lat: 52.4801211,
      lon: -1.8990618,
      tags: {
        "addr:city": "Birmingham",
        "addr:housenumber": "39-40",
        "addr:postcode": "B2 5DP",
        "addr:street": "Temple Street",
        amenity: "restaurant",
        brand: "Las Iguanas",
        "brand:wikidata": "Q19875012",
        check_date: "2024-07-16",
        "check_date:opening_hours": "2024-07-16",
        cuisine: "latin_american",
        "fhrs:id": "1368302",
        name: "Las Iguanas",
        opening_hours:
          "Mo-Tu 11:00-21:30; We-Th 11:00-22:00; Fr-Sa 11:00-22:30; Su 11:00-21:30",
        phone: "+44 1218 034883",
        source: "survey",
        "source:addr": "FHRS Open Data",
        website: "https://www.iguanas.co.uk/restaurants/birmingham-templest/",
      },
    },
    {
      type: "node",
      id: 310675208,
      lat: 52.4791439,
      lon: -1.9012564,
      tags: {
        "addr:city": "Birmingham",
        "addr:housenumber": "5A",
        "addr:postcode": "B2 4BG",
        "addr:street": "Ethel Street",
        amenity: "restaurant",
        cuisine: "italian",
        "fhrs:id": "720216",
        name: "La Galleria",
        source: "survey",
        website: "http://www.lagalleria-birmingham.co.uk/",
      },
    },
    {
      type: "node",
      id: 312747309,
      lat: 52.480468,
      lon: -1.8955226,
      tags: {
        "addr:city": "Birmingham",
        "addr:housename": "Martineau Square",
        "addr:housenumber": "25",
        "addr:postcode": "B2 4UH",
        "addr:street": "Martineau Place",
        amenity: "restaurant",
        name: "Al Arabi Grill House",
        source: "survey",
      },
    },
    {
      type: "node",
      id: 316757450,
      lat: 52.4829112,
      lon: -1.9044436,
      tags: {
        amenity: "restaurant",
        name: "Milan",
        source: "survey",
      },
    },
    {
      type: "node",
      id: 316757451,
      lat: 52.4832031,
      lon: -1.9056854,
      tags: {
        "addr:city": "Birmingham",
        "addr:housenumber": "18",
        "addr:street": "Fleet Street",
        amenity: "restaurant",
        name: "Itihaas",
        source: "survey",
        website: "https://www.itihaas.co.uk/",
      },
    },
    {
      type: "node",
      id: 330239419,
      lat: 52.4844431,
      lon: -1.9082153,
      tags: {
        amenity: "restaurant",
        name: "Rayu Pan-Asian",
        source: "survey",
      },
    },
    {
      type: "node",
      id: 330256376,
      lat: 52.4836495,
      lon: -1.9109322,
      tags: {
        "addr:city": "Birmingham",
        "addr:postcode": "B1 3JH",
        "addr:street": "Newhall Hill",
        amenity: "restaurant",
        email: "hello@vaultsbirmingham.com",
        name: "The Vaults",
        phone: "+44 121 212 9837",
        source: "survey",
      },
    },
    {
      type: "node",
      id: 330256383,
      lat: 52.4816163,
      lon: -1.9075252,
      tags: {
        amenity: "restaurant",
        check_date: "2024-09-01",
        name: "Opheem",
        source: "survey",
      },
    },
    {
      type: "node",
      id: 352650628,
      lat: 52.4775658,
      lon: -1.9130375,
      tags: {
        amenity: "restaurant",
        cuisine: "thai",
        name: "Thai Edge",
        source: "survey",
      },
    },
  ],
};

/* ---------------------------
   Component
---------------------------- */
export default function MapPage() {
  const [polygon, setPolygon] = useState<any[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);

  // Removed state variables for screen display: geminiResponse, isLoadingGemini, geminiError

  const [markerIcon, setMarkerIcon] = useState<L.Icon | null>(null);

  useEffect(() => {
    // We can safely import and access L here because useEffect only runs on the client.
    const L = require("leaflet"); 
    setMarkerIcon(
      new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -36],
      })
    );
  }, []);

  // 1) On first mount, load hardcoded JSON markers
  useEffect(() => {
    const fromJson: Pin[] = OSM_DATA.elements.map((el: any) => ({
      id: String(el.id),
      lat: el.lat,
      lon: el.lon,
      name: el.tags?.name,
      website: el.tags?.website,
      tags: el.tags,
      source: "json",
    }));
    setPins(fromJson);
  }, []);

  // 2) Also restore user-added pins from localStorage (and merge)
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved: Pin[] = JSON.parse(raw).filter((p: Pin) => p.source === "user");
    setPins((curr) => [...curr, ...saved]);
  }, []);

  // persist user pins only
  useEffect(() => {
    const onlyUser = pins.filter((p) => p.source === "user");
    localStorage.setItem(LS_KEY, JSON.stringify(onlyUser));
  }, [pins]);

  // 🚀 DEBUGGING useEffect: Fetch Gemini Response and PRINT ALL
  useEffect(() => {
    const fetchResponse = async () => {
      const endpoint = "/api/gemini/get_response";
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}${endpoint}` : endpoint;

      console.log("--- DEBUG: Starting Gemini Fetch ---");
      console.log(`Attempting to fetch from URL: ${url}`);
      
      try {
        const resp = await fetch(url);
        const text = await resp.text();

        if (!resp.ok) {
          console.error(`ERROR: HTTP Status ${resp.status} - Could not retrieve Gemini Plan.`);
          console.error("RAW SERVER RESPONSE TEXT:", text);
          return;
        }

        try {
            const data = JSON.parse(text);

            // The response is expected to be { "response": "..." }
            if (data.response) {
                console.log("--- GEMINI SESSION PLAN START (SUCCESS) ---");
                console.log(data.response); // <<< Prints the plan to the console
                console.log("--- GEMINI SESSION PLAN END ---");
            } else {
                console.warn("Gemini response endpoint returned successfully, but 'response' field was null or missing.");
                console.log("Returned Data:", data);
            }
        } catch (jsonError) {
            console.error("ERROR: Failed to parse JSON response from server.");
            console.error("RAW SERVER RESPONSE TEXT:", text);
        }
        
      } catch (error: any) {
        // This catches network errors (e.g., DNS failure, CORS block, server not running)
        console.error("FATAL ERROR: Failed to connect to backend (Network/CORS/Server down):", error.message);
      } finally {
         console.log("--- DEBUG: Gemini Fetch Attempt Complete ---");
      }
    };
    
    fetchResponse();
  }, []); // Run only once on mount
  // 🚀 END DEBUGGING useEffect


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
      { id: crypto.randomUUID(), lat, lon: lng, name, website, tags, source: "user" },
    ]);
  };

  const clearUserPins = () => {
    if (confirm("Clear user pins (keeps JSON pins)?")) {
      const keepJson = pins.filter((p) => p.source === "json");
      setPins(keepJson);
      localStorage.removeItem(LS_KEY);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Map Places (Gemini Plan in Console)</h1>
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
            className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
            onClick={clearUserPins}
          >
            Clear user pins
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <div className="w-full h-[78vh] rounded-xl shadow overflow-hidden">
          <MapContainer
            // Birmingham-ish
            center={[52.48, -1.90]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
            />

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

            {/* Render both JSON pins + user pins */}
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
                      {/* Title line similar to screenshot */}
                      <p className="text-xl font-extrabold">
                        Node{" "}
                        <a
                          href={`https://www.openstreetmap.org/node/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 underline"
                        >
                          {p.id}
                        </a>{" "}
                        —
                      </p>

                      {/* Tags header */}
                      <p className="mt-2 text-lg font-bold">
                        Tags <span className="ml-2 text-indigo-600 font-semibold">{tagCount}</span>
                      </p>

                      {/* Key=value list */}
                      <div className="font-mono whitespace-pre-wrap">
                        {tagEntries.map(([k, v]) => (
                          <div key={k}>
                            {k} = {String(v)}
                          </div>
                        ))}
                      </div>

                      {/* Website */}
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

                      {/* Coords */}
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
        </div>
      </div>
    </div>
  );
}