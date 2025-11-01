"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

export default function RestaurantMap() {
  const [restaurants, setRestaurants] = useState<any[]>([]);

  useEffect(() => {
    // 🔹 Replace this URL with your real API endpoint later
    fetch("/api/restaurants.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.elements) setRestaurants(data.elements);
      })
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  // Optional: blue custom icon
  const restaurantIcon = new L.Icon({
    iconUrl:
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconAnchor: [12, 41],
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-semibold mb-4">
        Restaurants in Birmingham 🍽️
      </h1>

      <div className="w-[90vw] h-[80vh] rounded-lg shadow-md overflow-hidden">
        <MapContainer
          center={[52.48, -1.9]} // Birmingham
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={`https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
          />

          {restaurants.map((r) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lon]}
              icon={restaurantIcon}
            >
              <Popup>
                <div className="text-sm leading-5">
                  <p className="font-semibold">
                    Node <a
                      href={`https://www.openstreetmap.org/node/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {r.id}
                    </a>
                  </p>
                  <hr className="my-1" />
                  <p className="font-semibold">Tags</p>
                  <ul className="list-none mb-2">
                    {r.tags &&
                      Object.entries(r.tags).map(([key, val]) => (
                        <li key={key}>
                          <strong>{key}</strong>: {String(val)}
                        </li>
                      ))}
                  </ul>
                  <p className="font-semibold">Coordinates</p>
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
