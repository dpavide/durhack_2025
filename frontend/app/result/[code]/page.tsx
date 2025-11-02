"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// Import Leaflet dependencies
import "leaflet/dist/leaflet.css";
import L, { LatLngExpression } from "leaflet";

/* ---------------------------
   Dynamic imports (SSR-safe)
---------------------------- */
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

/* ---------------------------
   Types
---------------------------- */
type PlaceDetail = {
  element_id: string;
  name: string;
  rating?: number;
  lat: number;
  lon: number;
  reviews?: any[];
};

type SelectionPin = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
};

/* ---------------------------
   Constants & Icons
---------------------------- */

// Define the custom icon for the winner
const winnerIcon = new L.DivIcon({
  className: "winner-marker-icon",
  html: `<div class="p-3 bg-yellow-400 border-4 border-white rounded-full shadow-xl text-3xl animate-bounce">🎉</div>`,
  iconSize: [56, 56],
  iconAnchor: [28, 56],
});

// Define the custom icon for the user's GPS (Pulsating Blue Dot)
const userLocationIcon = new L.DivIcon({
  className: "user-location-marker",
  html: '<div class="pulsating-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/* ---------------------------
   Map Marker Components
---------------------------- */

function WinnerMarker({ position, name }: { position: LatLngExpression; name: string }) {
  return (
    <Marker position={position} icon={winnerIcon}>
      <Popup>
        <div className="font-bold text-lg text-emerald-600">🏆 {name}</div>
        <div className="text-sm text-gray-600">Your final destination!</div>
      </Popup>
    </Marker>
  );
}

// User Location Marker Component
function LocationMarker() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.warn(`Geolocation watch error: ${err.message}`);
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return position === null ? null : (
    <Marker position={position} icon={userLocationIcon}>
      <Popup>📍 You are here</Popup>
    </Marker>
  );
}

/* ---------------------------
   Main Component
---------------------------- */
export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [winnerPlace, setWinnerPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultCenter: LatLngExpression = [54.7753, -1.584];

  const fetchWinnerDetails = useCallback(async (roomCode: string) => {
    if (!roomCode) return;

    try {
      const { count: totalParticipants } = await supabase
        .from("room_participants")
        .select("user_id", { count: "exact", head: true })
        .eq("room_code", roomCode);

      if (totalParticipants === null || totalParticipants === 0) {
        throw new Error("Cannot determine winner: No participants found.");
      }

      const { data: votesData } = await supabase
        .from("place_votes")
        .select("place_id")
        .eq("room_code", roomCode);

      if (!votesData) {
        throw new Error("Error fetching votes.");
      }

      const voteCounts = new Map<string, number>();
      for (const vote of votesData) {
        const id = String(vote.place_id);
        voteCounts.set(id, (voteCounts.get(id) ?? 0) + 1);
      }

      let winningPlaceId: string | null = null;
      for (const [id, count] of voteCounts.entries()) {
        if (count === totalParticipants) {
          winningPlaceId = id;
          break;
        }
      }

      if (!winningPlaceId) {
        throw new Error("No unanimous winner found. Voting may still be in progress.");
      }

      const { data: selectionsData } = await supabase
        .from("player_selections")
        .select("selections")
        .eq("session_id", roomCode)
        .limit(1);

      if (!selectionsData || selectionsData.length === 0) {
        throw new Error("Could not retrieve place coordinates.");
      }

      const selections: SelectionPin[] = selectionsData[0].selections || [];
      const winnerPin = selections.find((pin) => String(pin.id) === winningPlaceId);

      if (!winnerPin || winnerPin.lat === undefined || winnerPin.lon === undefined) {
        throw new Error("Winner coordinates not found in player selections.");
      }

      setWinnerPlace({
        element_id: winningPlaceId,
        name: winnerPin.name || "The Chosen Location",
        lat: winnerPin.lat,
        lon: winnerPin.lon,
      });
      setError(null);
    } catch (err: any) {
      console.error("Error in final result calculation:", err);
      setError(err.message || "Failed to finalize the meeting location.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!code) {
      router.replace("/");
      return;
    }
    fetchWinnerDetails(code);
  }, [code, router, fetchWinnerDetails]);

  const mapCenter: LatLngExpression = winnerPlace ? [winnerPlace.lat, winnerPlace.lon] : defaultCenter;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <script src="https://cdn.tailwindcss.com"></script>
        <div className="text-center p-6 bg-white rounded-xl shadow-xl">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-700 font-medium">Calculating final consensus...</p>
        </div>
      </div>
    );
  }

  if (error || !winnerPlace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <script src="https://cdn.tailwindcss.com"></script>
        <div className="text-center p-6 bg-white rounded-xl shadow-xl">
          <h1 className="text-2xl font-bold text-red-700 mb-2">Error Finalizing Result</h1>
          <p className="text-red-600 font-medium">{error || "No unanimous winner determined."}</p>
          <button
            onClick={() => router.replace(`/listings/${code}`)}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Return to Voting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-30px) scale(1.1); }
          60% { transform: translateY(-15px) scale(1.05); }
        }
        .animate-bounce { animation: bounce 2s infinite; }

        @keyframes pulsate {
          0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(0, 128, 255, 0.7); }
          70% { transform: scale(1.5); opacity: 0; box-shadow: 0 0 0 10px rgba(0, 128, 255, 0); }
          100% { transform: scale(1); opacity: 0; box-shadow: 0 0 0 0 rgba(0, 128, 255, 0); }
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
      `}</style>

      <header className="p-6 bg-emerald-600 text-white shadow-xl">
        <div className="container mx-auto">
          <h1 className="text-3xl font-extrabold flex items-center">🎉 Final Destination Chosen! 🏆</h1>
          <p className="mt-1 text-emerald-100">Meeting Code: {code}</p>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-2xl border-b-4 border-emerald-500 text-center">
          <h2 className="text-4xl font-black text-gray-800 mb-2">{winnerPlace.name}</h2>
          <p className="text-lg text-gray-600">This is where you're going!</p>
          <p className="text-sm text-gray-500 mt-1">
            GPS: {winnerPlace.lat.toFixed(5)}, {winnerPlace.lon.toFixed(5)}
          </p>
        </div>

        <div className="w-full h-[60vh] rounded-xl border-4 border-gray-300 shadow-xl overflow-hidden">
          <MapContainer
            key={winnerPlace.element_id}
            center={mapCenter}
            zoom={15}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
            />
            <WinnerMarker position={mapCenter} name={winnerPlace.name} />
            <LocationMarker />
          </MapContainer>
        </div>
      </main>

      {/* Footer / CTA */}
      <footer className="p-6 text-center text-gray-600 bg-white shadow-inner">
        <p>Planning complete. Time to meet up!</p>

        {/* ✅ MAIN MENU BUTTON ADDED HERE */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => router.push("/home")}
            className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:bg-emerald-700 transition duration-200"
          >
          Main Menu
          </button>
        </div>
      </footer>
    </div>
  );
}
