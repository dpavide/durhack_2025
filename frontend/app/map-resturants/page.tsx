"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// 🧠 Dynamically import react-leaflet components (prevents SSR window errors)
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

export default function RestaurantMap() {
  const [restaurants, setRestaurants] = useState<any[]>([]);

  // 🔹 Load local JSON (replace with your API later)
  useEffect(() => {
    fetch("/api/restaurants.json")
      .then((res) => res.json())
      .then((data) => {
        if (data?.elements) setRestaurants(data.elements);
      })
      .catch((err) => console.error("Error loading restaurants:", err));
  }, []);

  // Custom blue icon for restaurants
  const restaurantIcon = new L.Icon({
    iconUrl:
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconAnchor: [12, 41],
    popupAnchor: [0, -40],
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-semibold mb-4">
        🍴 Birmingham Restaurants Map
      </h1>

      <div className="w-[90vw] h-[80vh] rounded-lg shadow-md overflow-hidden">
        <MapContainer
          center={[52.48, -1.9]} // Birmingham centre
          zoom={14}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
          />

          {/* 🧩 Create markers for every restaurant */}
          {restaurants.map((r) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lon]}
              icon={restaurantIcon}
            >
              <Popup>
                <div className="text-sm leading-5 space-y-1">
                  <p className="font-semibold">
                    Node{" "}
                    <a
                      href={`https://www.openstreetmap.org/node/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {r.id}
                    </a>
                  </p>
                  <hr />
                  <p className="font-semibold">Tags:</p>
                  <ul className="list-none pl-0">
                    {r.tags &&
                      Object.entries(r.tags).map(([k, v]) => (
                        <li key={k}>
                          <strong>{k}</strong>: {String(v)}
                        </li>
                      ))}
                  </ul>
                  <p className="font-semibold">Coordinates:</p>
                  <p>
                    {r.lat.toFixed(6)}, {r.lon.toFixed(6)} (lat/lon)
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
