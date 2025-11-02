"use client";

import React, { useEffect, useMemo, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L, { LatLngExpression } from "leaflet";
// Import useMap and useMapEvents
import { useMapEvents, useMap } from "react-leaflet";
import { supabase } from "@/lib/supabaseClient";
// Import useParams to read [code] from URL
import { useRouter, useParams } from "next/navigation";

/* ---------------------------
   Dynamic imports (SSR-safe)
---------------------------- */
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const FeatureGroup = dynamic(() => import("react-leaflet").then((m) => m.FeatureGroup), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const EditControl = (dynamic(() => import("react-leaflet-draw").then((m: any) => m.EditControl), { ssr: false }) as unknown) as ComponentType<any>;

/* ---------------------------
   Types
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
const MAX_API_PINS = 10;
const MAX_SELECTIONS = 2;

/* ---------------------------
   Random sampling helper
---------------------------- */
function sampleUpTo<T>(arr: T[], n: number): T[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const copy = arr.slice();
  const len = copy.length;
  const take = Math.min(n, len);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}

/* ---------------------------
   Map click listener
---------------------------- */
function ClickBinder({ enabled, onClick }: { enabled: boolean; onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
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
    // FIX: Wrap logic in map.whenReady() to ensure map is fully initialized
    map.whenReady(() => {
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
    });
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={userLocationIcon}>
      <Popup>📍 You are here</Popup>
    </Marker>
  );
}


/* ---------------------------
   Main Component
---------------------------- */
export default function MapPlacesPage() { // Renamed component for clarity
  const router = useRouter();
  // FIX: Use useParams to read [code]
  const params = useParams<{ code: string }>();
  
  // FIX: Get sessionId from params.code
  const sessionId = (params?.code ?? "").toString().toUpperCase();

  const [polygon, setPolygon] = useState<any[]>([]); // This page doesn't draw polygons, but might display one
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start loading true
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [playersReady, setPlayersReady] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [allReady, setAllReady] = useState(false);

  /* ---------------------------
     Setup Supabase + session
  ---------------------------- */
  useEffect(() => {
    // Session ID is now derived from useParams at component root
    if (!sessionId) {
      setLoadError("Missing session ID in URL.");
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    // Also fetch the polygon for this room to display it
    (async () => {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("polygon_geojson")
        .eq("room_code", sessionId)
        .single();
      
      if (error) {
        console.warn("Could not load room polygon", error.message);
      } else if (room?.polygon_geojson) {
        // We need a helper to convert GeoJSON back to Leaflet positions
        try {
          const geometry = room.polygon_geojson.type === "Feature" ? room.polygon_geojson.geometry : room.polygon_geojson;
          if (geometry.type === "Polygon") {
            const positions = geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]); // Swap lon/lat
            setPolygon(positions);
          }
        } catch (e) {
          console.error("Error parsing polygon GeoJSON:", e);
        }
      }
    })();
  }, [sessionId]);

  /* ---------------------------
     Marker icons
  ---------------------------- */
  const defaultIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -36],
      }),
    []
  );

  const greenIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -36],
      }),
    []
  );

  /* ---------------------------
     Toggle selected pin (limit to 2)
  ---------------------------- */
  const toggleSelect = (id: string) => {
    setSelectedPins((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  /* ---------------------------
     Supabase: submit selections + wait for all
  ---------------------------- */
  const handleContinue = async () => {
    if (!sessionId || !userId) {
      console.warn("Missing session or user");
      return;
    }

    const selectedPinObjects = pins.filter((p) => selectedPins.includes(p.id));

    if (selectedPinObjects.length !== selectedPins.length) {
      console.error("Data mismatch: Could not find all selected pin objects in state.");
      return;
    }

    await supabase.from("player_selections").upsert(
      {
        session_id: sessionId,
        player_id: userId,
        selections: selectedPinObjects,
        ready: true,
      },
      { onConflict: "session_id,player_id" }
    );

    // Listen for changes
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_selections", filter: `session_id=eq.${sessionId}` }, // Added filter
        async () => {
          const { count: total } = await supabase
            .from("player_selections")
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId);

          const { count: readyCount } = await supabase
            .from("player_selections")
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId)
            .eq("ready", true);

          setPlayersReady(readyCount || 0);
          setTotalPlayers(total || 0);

          if (readyCount !== null && total !== null && readyCount === total && total > 0) {
            setAllReady(true);
          }
        }
      )
      .subscribe();
  };

  useEffect(() => {
    if (allReady && sessionId) {
      setTimeout(() => {
        // FIX: Redirect to vote page using search param as it expects
        router.push(`/listings/${sessionId}`);
      }, 1500);
    }
  }, [allReady, sessionId, router]);

  /* ---------------------------
     Load + save user pins
  ---------------------------- */
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const saved: Pin[] = JSON.parse(raw).filter((p: Pin) => p.source === "user");
      setPins((curr) => [...curr, ...saved]);
    } catch {}
  }, []);

  useEffect(() => {
    const onlyUser = pins.filter((p) => p.source === "user");
    localStorage.setItem(LS_KEY, JSON.stringify(onlyUser));
  }, [pins]);

  const addPin = (lat: number, lng: number) => {
    const name = window.prompt("Name (optional)") || undefined;
    const website = window.prompt("Website (optional)") || undefined;
    setPins((prev) => [
      ...prev,
      { id: crypto.randomUUID(), lat, lon: lng, name, website, source: "user" },
    ]);
  };

  const clearUserPins = () => {
    if (window.confirm("Clear user pins?")) {
      const keepJson = pins.filter((p) => p.source === "json");
      setPins(keepJson);
      localStorage.removeItem(LS_KEY);
    }
  };

  /* ---------------------------
     Fetch + random sample
  ---------------------------- */
  useEffect(() => {
    // Only fetch if we have a session ID
    if (!sessionId) return;
    
    (async () => {
      setLoading(true);
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
      // This page should call /api/map/search, which uses the saved polygon
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/map/search` : "/api/map/search";
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`Server error: ${resp.status}`);
        }
        const data = await resp.json();
        const withCoords = (data?.elements ?? []).filter((el: any) => typeof el.lat === "number");
        const sampled = sampleUpTo(withCoords, MAX_API_PINS);
        const fromApi: Pin[] = sampled.map((el: any) => ({
          id: String(el.id ?? `${el.type}_${Math.random().toString(36).slice(2, 8)}`),
          lat: el.lat,
          lon: el.lon,
          name: el.tags?.name,
          website: el.tags?.website,
          tags: el.tags,
          source: "json",
        }));
        setPins((existing) => {
          const userPins = existing.filter((p) => p.source === "user");
          return [...fromApi, ...userPins];
        });
      } catch (err: any) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]); // Depends on sessionId

  /* ---------------------------
     Render
  ---------------------------- */
  if (loadError) {
  	return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-700 p-6">
  		<h1 className="text-2xl font-bold mb-4">Error 😥</h1>
      <p>{loadError}</p>
      <p className="mt-2 text-sm">Please check the URL and try again.</p>
    </div>
    );
  }
  
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
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Meetspace Map 🗺️</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Select up to {MAX_SELECTIONS} locations and press Continue.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                pinMode ? "bg-emerald-600 text-white" : "bg-zinc-200 hover:bg-zinc-300"
              }`}
              onClick={() => setPinMode((v) => !v)}
            >
              {pinMode ? "📌 Pin mode: ON" : "📌 Pin mode: OFF"}
            </button>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
              onClick={clearUserPins}
            >
              🗑️ Clear pins
            </button>
          </div>
        </div>

        <div className="w-full h-[70vh] rounded-lg border border-black/[.08] dark:border-white/[.145] shadow-md overflow-hidden relative">
          <MapContainer center={[54.7753, -1.5840]} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
            />
            <ClickBinder enabled={pinMode} onClick={addPin} />
            <FeatureGroup>{polygon.length > 0 && <Polygon positions={polygon as any} color="#2563eb" />}</FeatureGroup>
            
            {/* Render all the points of interest */}
            {pins.map((p) => {
              const isSelected = selectedPins.includes(p.id);
              return (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lon]}
                  icon={isSelected ? greenIcon : defaultIcon}
                  eventHandlers={{ click: () => toggleSelect(p.id) }}
                >
                  <Popup>{p.name || "Unknown"}</Popup>
                </Marker>
              );
            })}
            
            {/* NEW: Add the user location marker component */}
            <LocationMarker />
            
          </MapContainer>

          {loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white rounded shadow">
              Loading markers… ⏳
            </div>
          )}
        </div>

        {/* Selection summary + continue */}
        <div className="mt-6 flex flex-col items-center">
          <button
            disabled={selectedPins.length !== MAX_SELECTIONS}
            onClick={handleContinue}
            className={`px-6 py-3 rounded-full text-white font-semibold text-lg transition ${
              selectedPins.length === MAX_SELECTIONS
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Continue ({selectedPins.length}/{MAX_SELECTIONS}) ➡️
          </button>

          {playersReady > 0 && (
            <p className="mt-3 text-sm text-gray-600">
              ✅ {playersReady}/{totalPlayers} players ready
            </p>
          )}
          {allReady && (
            <p className="mt-3 text-lg font-semibold text-emerald-600 animate-pulse">
              All players ready! 🚀
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

