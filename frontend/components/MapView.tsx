"use client";

import { MapContainer, TileLayer, FeatureGroup, Polygon } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { useState } from "react";

export default function MapView() {
  const [polygon, setPolygon] = useState<any[]>([]);

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <h1 className="text-2xl font-semibold mb-4">Select Area on Map</h1>

      <div className="w-[90vw] h-[80vh] rounded-lg shadow-md overflow-hidden">
        <MapContainer
          center={[24.4539, 54.3773]} // Default: Abu Dhabi
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
  attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  url="https://api.maptiler.com/maps/basic-v2/256/{z}/{x}/{y}.png?key=YOUR_MAPTILER_API_KEY"
/>

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
        </MapContainer>
      </div>

      <pre className="mt-4 p-3 bg-white border rounded text-sm w-[90vw] overflow-x-auto">
        {JSON.stringify(polygon, null, 2)}
      </pre>
    </div>
  );
}
