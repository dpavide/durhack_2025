"use client";

import dynamic from "next/dynamic";

// Load MapView only on the client (avoids “window is not defined”)
const MapView = dynamic(() => import("../../components/MapView"), { ssr: false });

export default function MapPage() {
  return <MapView />;
}
