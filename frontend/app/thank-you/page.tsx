"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

// Minimal marker icon fix so markers show up reliably
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Center on Durham, UK
const DURHAM: [number, number] = [54.7753, -1.5840];

/**
 * Build a set of marker positions that form the text "THANK YOU" near the given center.
 * We use a small grid in degrees — each grid step is a small lat/lon fraction so letters are
 * roughly a few hundred metres tall.
 */
function buildThankYouMarkers(center: [number, number]) {
  const [baseLat, baseLon] = center;
  // grid settings (tweak for size)
  const latStep = 0.00075; // ≈ 83m
  const lonStep = 0.00095; // scaled for longitude

  // Helper to translate grid (col, row) into lat/lon. row grows downward.
  const pt = (col: number, row: number) => [baseLat - row * latStep, baseLon + col * lonStep];

  // For each letter we define an array of grid coords (col,row) to place markers on.
  // We'll place letters left-to-right with a horizontal offset.

  const letters: Array<Array<[number, number]>> = [];

  // Letter T: top bar and a center stem
  letters.push([
    // top bar (cols 0..4 at row 0)
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    // stem (col 2 rows 1..4)
    [2, 1], [2, 2], [2, 3], [2, 4],
  ]);

  // Letter H: two verticals and a middle bar
  letters.push([
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
    [1, 2],
  ]);

  // Letter A: an A shape (two diagonals + crossbar)
  letters.push([
    [0, 4], [0, 3], [1, 2], [2, 1], [3, 0], [4, 1], [5, 2], [6, 3], [6, 4],
    [2, 3], [3, 3], [4, 3], // crossbar
  ]);

  // Letter N: diagonal between two verticals
  letters.push([
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 1], [2, 2], [3, 3],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ]);

  // Letter K: vertical + two diagonals
  letters.push([
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 2], [2, 1], [2, 3],
  ]);

  // Small gap between words; we'll add horizontal offsets accordingly

  // Letter Y: upper arms and stem
  letters.push([
    [0, 0], [1, 1], [2, 2],
    [3, 1], [4, 0],
    [2, 3], [2, 4],
  ]);

  // Letter O: ring
  letters.push([
    [0, 1], [0, 2], [0, 3],
    [1, 0], [2, 0], [3, 0],
    [4, 1], [4, 2], [4, 3],
    [1, 4], [2, 4], [3, 4],
  ]);

  // Letter U: two verticals + bottom bar
  letters.push([
    [0, 0], [0, 1], [0, 2], [0, 3],
    [1, 4], [2, 4], [3, 4],
    [4, 0], [4, 1], [4, 2], [4, 3],
  ]);

  // Now translate letters into absolute grid positions and then into lat/lon.
  const markers: Array<{ id: string; lat: number; lon: number; label?: string }> = [];
  let cursorX = -12; // start to the left of center
  const letterSpacing = 8; // grid columns to advance between letters
  const wordSpacing = 4; // extra gap between words

  // First five letters are "THANK" then a gap then "YOU"
  for (let i = 0; i < letters.length; i++) {
    const shape = letters[i];
    // For the transition between K and Y (space between words), add extra gap
    if (i === 5) cursorX += wordSpacing; // after K before Y

    for (const [col, row] of shape) {
      const absoluteCol = cursorX + col;
      const absoluteRow = row; // already 0..4 (height)
      const [lat, lon] = pt(absoluteCol, absoluteRow);
      markers.push({ id: `${i}-${col}-${row}`, lat, lon });
    }

    cursorX += letterSpacing;
  }

  return markers;
}

export default function MapThankYouPage() {
  const router = useRouter();
  const center = DURHAM;

  const markers = useMemo(() => buildThankYouMarkers(center), [center]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Map — "THANK YOU" in pins 🌟</h1>

        <div className="w-full h-[70vh] rounded-lg border border-black/[.06] shadow overflow-hidden">
          <MapContainer center={center} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
            />

            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lon]}>
                <Popup>
                  {`Pin ${m.id}`}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-zinc-600">Centered on Durham, UK — pins arranged to spell <strong>THANK YOU</strong>.</p>

          {/* Main menu button routing to frontend/app/home */}
          <div>
            <button
              onClick={() => router.push("/home")}
              className="ml-4 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 transition"
            >
              Main menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
