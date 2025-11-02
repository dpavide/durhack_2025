"use client";

import React, { useEffect, useMemo, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import { useMapEvents } from "react-leaflet";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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
   Main Component
---------------------------- */
export default function MapPage() {
  const router = useRouter();

  const [polygon, setPolygon] = useState<any[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [playersReady, setPlayersReady] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [allReady, setAllReady] = useState(false);

  /* ---------------------------
     Setup Supabase + session
  ---------------------------- */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setSessionId(urlParams.get("session") ?? null);

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

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
      // Use console.warn instead of alert
      console.warn("Missing session or user");
      return;
    }

    // --- FIX IMPLEMENTED HERE ---
    // 1. Find the full pin objects from the 'pins' state array
    const selectedPinObjects = pins.filter((p) => selectedPins.includes(p.id));

    // 2. Check if we found all of them (sanity check)
    if (selectedPinObjects.length !== selectedPins.length) {
      console.error("Data mismatch: Could not find all selected pin objects in state.");
      return;
    }
    // --- END OF FIX ---

    await supabase.from("player_selections").upsert(
      {
        session_id: sessionId,
        player_id: userId,
        selections: selectedPinObjects, // 3. Save the array of objects, not the array of IDs
        ready: true,
      },
      { onConflict: "session_id,player_id" }
    );

    // Listen for changes
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_selections" },
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

          if (readyCount === total && total > 0) {
            setAllReady(true);
          }
        }
      )
      .subscribe();
  };

  useEffect(() => {
    if (allReady && sessionId) {
      setTimeout(() => {
        router.push(`/vote?session=${sessionId}`);
      }, 1500);
    }
  }, [allReady, sessionId, router]); // Added router to dependency array

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
    // Use a custom modal/prompt in a real app, window.prompt is blocking
    const name = window.prompt("Name (optional)") || undefined;
    const website = window.prompt("Website (optional)") || undefined;
    setPins((prev) => [
      ...prev,
      { id: crypto.randomUUID(), lat, lon: lng, name, website, source: "user" },
    ]);
  };

  const clearUserPins = () => {
    // Use a custom modal/confirm in a real app
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
    (async () => {
      setLoading(true);
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
      const url = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/map/search` : "/api/map/search";
      try {
        const resp = await fetch(url);
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
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------------
     Render
  ---------------------------- */
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Meetspace Map</h1>
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
              {pinMode ? "Pin mode: ON" : "Pin mode: OFF"}
            </button>
            <button
              className="px-4 py-2 rounded-full text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
              onClick={clearUserPins}
            >
              Clear pins
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

          {loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white rounded shadow">
              Loading markers…
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

