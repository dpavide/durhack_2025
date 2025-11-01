"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useMap, Marker } from "react-leaflet";

// Ensure Leaflet components are only loaded on the client side
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const FeatureGroup = dynamic(
  () => import("react-leaflet").then((mod) => mod.FeatureGroup),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const EditControl = dynamic(
  () => import("react-leaflet-draw").then((mod) => mod.EditControl),
  { ssr: false }
);

// Define the structure for coordinates
interface Coords {
  lat: number;
  lon: number;
}

// Helper component to find user location and update the map
function LocationMarker({ onLocationFound }: { onLocationFound: (loc: Coords) => void }) {
  const map = useMap();
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported by your browser.");
      return;
    }

    // Function to handle successful location retrieval
    const success = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const latlng: [number, number] = [latitude, longitude];
      
      setPosition(latlng);
      onLocationFound({ lat: latitude, lon: longitude });
      
      // Pan the map to the user's location and zoom in
      map.flyTo(latlng, 16, { animate: true, duration: 1.5 });
    };

    // Function to handle errors
    const error = (err: GeolocationPositionError) => {
      console.error(`Geolocation ERROR(${err.code}): ${err.message}`);
    };

    // Request the current position with options for accuracy
    navigator.geolocation.getCurrentPosition(success, error, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  }, [map, onLocationFound]);

  // Use a standard Leaflet icon for the marker (assuming you fixed the icons in MapPage)
  return position === null ? null : (
    <Marker position={position}>
      <p>Your Current Location</p>
    </Marker>
  );
}

// The main Map Page component
export default function MapPage() {
  const [polygon, setPolygon] = useState<Coords[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [backendMessage, setBackendMessage] = useState<string>("");

  useEffect(() => {
    setIsClient(true);
    // Fix Leaflet icon paths
    if (typeof window !== "undefined") {
      const L = require("leaflet");
      // Fix for default icons not appearing in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    }
  }, []);

  const toJsonCoords = (latlngs: any[]): Coords[] =>
    latlngs.map((ll: any) => ({ lat: ll.lat, lon: ll.lng }));

  // Function to handle location found and send it to FastAPI
  const handleLocationFound = useCallback(async (location: Coords) => {
    setUserLocation(location);
    setBackendMessage("Location found. Sending to backend...");

    // **Backend Submission**
    try {
      // NOTE: Replace this URL with your actual FastAPI deployment URL
      const backendUrl = "https://your-vercel-domain.vercel.app/api/location"; 
      
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(location),
      });

      const data = await response.json();

      if (response.ok) {
        setBackendMessage(`Location sent! Backend message: ${data.message}`);
      } else {
        setBackendMessage(`Error sending location. Status: ${response.status}`);
        console.error("Backend error:", data);
      }
    } catch (error) {
      setBackendMessage("Error connecting to backend.");
      console.error("Fetch error:", error);
    }
  }, []); // useCallback ensures this function has a stable reference

  // ... (handleCreated, handleEdited, handleDeleted remain the same)
  const handleCreated = (e: any) => {
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      const latlngs = layer.getLatLngs()[0];
      setPolygon(toJsonCoords(latlngs));
      layer.on("edit", () => {
        const updated = layer.getLatLngs()[0];
        setPolygon(toJsonCoords(updated));
      });
    }
  };

  const handleEdited = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: any) => {
      if (typeof layer.getLatLngs === "function") {
        const latlngs = layer.getLatLngs()[0];
        setPolygon(toJsonCoords(latlngs));
        layer.on("edit", () => {
          const updated = layer.getLatLngs()[0];
          setPolygon(toJsonCoords(updated));
        });
      }
    });
  };

  const handleDeleted = () => {
    setPolygon([]);
  };

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
        <div className="text-zinc-900 dark:text-zinc-100">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="w-full max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Select Area on Map & Get GPS
          </h1>
          <Link
            href="/user-info"
            className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline"
          >
            Back to user info
          </Link>
        </div>
        
        {/* Location Status Message */}
        <div className={`p-3 text-sm rounded-lg mb-4 ${userLocation ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
          {backendMessage || "Click 'Allow' when prompted to share your location."}
        </div>

        <div className="w-full h-[70vh] rounded-lg border border-black/[.08] dark:border-white/[.145] shadow-md overflow-hidden">
          <MapContainer
            center={[24.4539, 54.3773]} // Default center (e.g., Abu Dhabi)
            zoom={12}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`}
              tileSize={512}
              zoomOffset={-1}
              maxZoom={19}
            />
            {/* **Insert the Location Marker component here** */}
            <LocationMarker onLocationFound={handleLocationFound} />

            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handleCreated}
                onEdited={handleEdited}
                onDeleted={handleDeleted}
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
                <Polygon
                  positions={polygon.map((p) => [p.lat, p.lon]) as any}
                  color="#2563eb"
                />
              )}
            </FeatureGroup>
          </MapContainer>
        </div>

        {userLocation && (
          <pre className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm overflow-x-auto text-zinc-900 dark:text-zinc-100">
            **Current User Location (Sent to FastAPI):**
            {JSON.stringify(userLocation, null, 2)}
          </pre>
        )}
        
        {polygon.length > 0 && (
          <pre className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm overflow-x-auto text-zinc-900 dark:text-zinc-100">
            **Drawn Polygon Coords:**
            {JSON.stringify(polygon, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}