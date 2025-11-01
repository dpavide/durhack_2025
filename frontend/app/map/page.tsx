"use client";

import dynamic from "next/dynamic";

// Dynamically import MapView so it only runs in the browser (fixes window-is-not-defined)
const MapView = dynamic(() => import("../../components/MapView"), { ssr: false });

export default function MapPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <MapView />
    </main>
  );
}
