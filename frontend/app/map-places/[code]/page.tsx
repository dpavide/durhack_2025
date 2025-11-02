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
const MAX_API_PINS = 10;
const MAX_SELECTIONS = 2; // Maximum places to select

/* ---------------------------
   Tiny fix: Ensure default Marker icons are set (fixes invisible markers for some users)
   This is the minimal necessary change to address the problem where non-admins
   or other browsers/devices couldn't see the default marker images.
---------------------------- */
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ---------------------------
   Helper Components
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

function ClickBinder({ enabled, onClick }: { enabled: boolean; onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

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
    map.whenReady(() => {
      if (!navigator.geolocation) {
        return;
      }
      navigator.geolocation.getCurrentPosition((pos) => {
        const latLng: LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        setPosition(latLng);
        map.flyTo(latLng, 14);
      });
      
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {}
      );
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
export default function MapPlacesPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const sessionId = (params?.code ?? "").toString().toUpperCase();

  const [polygon, setPolygon] = useState<any[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  
  // State for the waiting logic
  const [playersReady, setPlayersReady] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [allReady, setAllReady] = useState(false);

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
     Helper Functions
  ---------------------------- */
  const toggleSelect = (id: string) => {
    setSelectedPins((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

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
  
  // --- Core function to check and update readiness state ---
  const checkReadiness = async (currentSessionId: string) => {
    // 1. Fetch total participants in the room
    const { count: totalInRoom } = await supabase
        .from("room_participants")
        .select("user_id", { count: "exact", head: true })
        .eq("room_code", currentSessionId);

    // 2. Fetch number of players who are 'ready: true' in player_selections
    const { count: readyCount } = await supabase
        .from("player_selections")
        .select("player_id", { count: "exact", head: true })
        .eq("session_id", currentSessionId)
        .eq("ready", true);

    setPlayersReady(readyCount || 0);
    setTotalPlayers(totalInRoom || 0);

    // 3. Check if ALL participants are ready
    if (totalInRoom !== null && readyCount !== null && readyCount === totalInRoom && totalInRoom > 0) {
        setAllReady(true);
    }
  };

  /* ---------------------------
     Data Loading and Setup Effects (unchanged)
  --------------------------- */
  useEffect(() => {
    if (!sessionId) {
      setLoadError("Missing session ID in URL.");
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });

    // Load Polygon
    (async () => {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("polygon_geojson")
        .eq("room_code", sessionId)
        .single();
      
      if (!error && room?.polygon_geojson) {
        try {
          const geometry = room.polygon_geojson.type === "Feature" ? room.polygon_geojson.geometry : room.polygon_geojson;
          if (geometry.type === "Polygon") {
            const positions = geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]);
            setPolygon(positions);
          }
        } catch (e) { console.error("Error parsing polygon GeoJSON:", e); }
      }
    })();
  }, [sessionId]);
  
  // Local storage effects...
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

  // Fetch API Pins...
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/map/search` : "/api/map/search";
      try {
        const resp = await fetch(url);
        if (!resp.ok) { throw new Error(`Server error: ${resp.status}`); }
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
      } catch (err: any) { setLoadError(err.message); } finally { setLoading(false); }
    })();
  }, [sessionId]);

  // ----------------------------------------------------------------------
  // 🔑 CORE SYNC FIX 1: Realtime Subscription (Listens for ready status immediately)
  // ----------------------------------------------------------------------
  useEffect(() => {
      if (!sessionId) return;
      
      // 1. Run an initial check immediately on load
      checkReadiness(sessionId);

      // 2. Subscribe to the Realtime channel for updates
      const channel = supabase
          .channel(`selection-${sessionId}`) 
          .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "player_selections", filter: `session_id=eq.${sessionId}` },
              // When ANY player's selection is updated, re-check the readiness
              () => checkReadiness(sessionId)
          )
          // Also listen if a player joins/leaves the room to update the 'Total Players' count
          .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${sessionId}` },
              // When ANY player joins/leaves, re-check the readiness
              () => checkReadiness(sessionId)
          )
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);


  // ----------------------------------------------------------------------
  // 🔑 CORE SYNC FIX 2: Simplified handleContinue (Only Submits Data)
  //    + Propagate selections to participants who haven't submitted yet
  // ----------------------------------------------------------------------
  const handleContinue = async () => {
    if (!sessionId || !userId) {
      console.warn("Missing session or user");
      return;
    }

    const selectedPinObjects = pins.filter((p) => selectedPins.includes(p.id));

    // Submit the user's selected places and set their 'ready' status to true.
    const { error } = await supabase.from("player_selections").upsert(
      {
        session_id: sessionId,
        player_id: userId,
        selections: selectedPinObjects,
        ready: true, // Sets this player to ready
      },
      { onConflict: "session_id,player_id" }
    );
    
    if (error) {
        console.error("Failed to submit selections:", error.message);
    }

    // ---------- NEW: propagate the selections to participants who haven't submitted ----------
    try {
      // 1) Get participant list
      const { data: participants } = await supabase
        .from("room_participants")
        .select("user_id")
        .eq("room_code", sessionId);

      const participantIds: string[] = (participants || []).map((p: any) => p.user_id);

      if (participantIds.length > 0) {
        // 2) Get existing player_selections for this session to know who already submitted
        const { data: existingSelections } = await supabase
          .from("player_selections")
          .select("player_id")
          .eq("session_id", sessionId);

        const existingIds = new Set<string>((existingSelections || []).map((r: any) => r.player_id));

        // 3) For participants missing selections, insert a row with the same selections & ready:true
        const toInsert = participantIds
          .filter((pid) => !existingIds.has(pid))
          .map((pid) => ({
            session_id: sessionId,
            player_id: pid,
            selections: selectedPinObjects,
            ready: true,
          }));

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("player_selections").insert(toInsert);
          if (insertErr) {
            console.error("Failed to propagate selections to participants:", insertErr.message);
          }
        }
      }
    } catch (propErr) {
      console.error("Error propagating selections:", propErr);
    }
    
    // CRITICAL Fix: Removed channel handling here; readiness handled elsewhere
  };

  /* ----------------------------------------------------------------------
     🔑 CORE SYNC FIX 3: Redirection Trigger (Waits for allReady state)
  ---------------------------------------------------------------------- */
  useEffect(() => {
    if (allReady && sessionId) {
      // Delay redirect slightly for a better visual cue
      const timer = setTimeout(() => {
        router.push(`/listings/${sessionId}`);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [allReady, sessionId, router]);

  /* ---------------------------
     Render
  --------------------------- */
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
      {/* CSS for pulsating marker dot */}
      <style>{`
        @keyframes pulsate { 0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(0, 128, 255, 0.7); } 70% { transform: scale(1.5); opacity: 0; box-shadow: 0 0 0 10px rgba(0, 128, 255, 0); } 100% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 rgba(0, 128, 255, 0); } }
        .pulsating-dot { width: 16px; height: 16px; background-color: #007bff; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 0 rgba(0, 128, 255, 0.7); animation: pulsate 2s infinite; }
      `}</style>
      
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Meetspace Map 🗺️</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Select up to **{MAX_SELECTIONS} locations** and press Continue.
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
            disabled={selectedPins.length !== MAX_SELECTIONS || allReady}
            onClick={handleContinue}
            className={`px-6 py-3 rounded-full text-white font-semibold text-lg transition ${
              selectedPins.length === MAX_SELECTIONS && !allReady
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
              All players ready! Redirecting... 🚀
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
