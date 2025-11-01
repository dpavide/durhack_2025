"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Client-only Leaflet components
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const FeatureGroup = dynamic(() => import("react-leaflet").then((m) => m.FeatureGroup), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });
const EditControl = dynamic(() => import("react-leaflet-draw").then((m) => m.EditControl), { ssr: false });

type LatLon = { lat: number; lon: number };

// Helpers: convert between positions and GeoJSON Polygon Feature
function positionsToGeoJSON(positions: LatLon[]) {
	if (!positions || positions.length < 3) return null;
	const ring = positions.map((p) => [p.lon, p.lat]);
	// close the ring
	if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
		ring.push(ring[0]);
	}
	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "Polygon",
			coordinates: [ring],
		},
	};
}

function geoJSONToPositions(geo: any): LatLon[] {
	try {
		if (!geo) return [];
		const geometry = geo.type === "Feature" ? geo.geometry : geo;
		if (!geometry || geometry.type !== "Polygon") return [];
		const ring = geometry.coordinates?.[0] ?? [];
		// drop closing coord if present
		const coords = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
			? ring.slice(0, -1)
			: ring;
		return coords.map((c: [number, number]) => ({ lon: c[0], lat: c[1] }));
	} catch {
		return [];
	}
}

export default function MapPage() {
	const params = useParams<{ code: string }>();
	const router = useRouter();
	const code = (params?.code ?? "").toString().toUpperCase();

	const [polygon, setPolygon] = useState<LatLon[]>([]);
	const [isClient, setIsClient] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);
	const [masterId, setMasterId] = useState<string | null>(null);
	const isMaster = useMemo(() => !!userId && !!masterId && userId === masterId, [userId, masterId]);
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Client-only mount and Leaflet icon fix
	useEffect(() => {
		setIsClient(true);
		if (typeof window !== "undefined") {
			const L = require("leaflet");
			delete (L.Icon.Default.prototype as any)._getIconUrl;
			L.Icon.Default.mergeOptions({
				iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
				iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
				shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
			});
		}
	}, []);

	// Load session, room master and existing polygon
	useEffect(() => {
		(async () => {
			const { data: s } = await supabase.auth.getSession();
			const u = s.session?.user;
			if (!u) {
				router.replace("/");
				return;
			}
			setUserId(u.id);

			const { data: room, error } = await supabase
				.from("rooms")
				.select("master_id, polygon_geojson")
				.eq("room_code", code)
				.single();
			if (error || !room) {
				router.replace("/home");
				return;
			}
			setMasterId(room.master_id);
			setPolygon(geoJSONToPositions(room.polygon_geojson));
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [code]);

	// Realtime: listen for polygon updates
	useEffect(() => {
		if (!code) return;
		const channel = supabase
			.channel(`map-${code}`)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
				(payload) => {
					const poly = (payload.new as any)?.polygon_geojson ?? null;
					setPolygon(geoJSONToPositions(poly));
				}
			)
			.subscribe();
		return () => void supabase.removeChannel(channel);
	}, [code]);

	// Debounced save to Supabase (master only)
	const savePolygon = (positions: LatLon[]) => {
		if (!isMaster) return;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(async () => {
			const feature = positionsToGeoJSON(positions);
			const { error } = await supabase
				.from("rooms")
				.update({ polygon_geojson: feature })
				.eq("room_code", code)
				.eq("master_id", userId);
			if (error) {
				// ...optional: surface error
			}
		}, 400);
	};

	const toJsonCoords = (latlngs: any[]) => latlngs.map((ll: any) => ({ lat: ll.lat, lon: ll.lng }));

	const handleCreated = (e: any) => {
		if (!isMaster) return;
		const { layerType, layer } = e;
		if (layerType === "polygon") {
			const latlngs = layer.getLatLngs()[0];
			const next = toJsonCoords(latlngs);
			setPolygon(next);
			savePolygon(next);
			layer.on("edit", () => {
				const updated = layer.getLatLngs()[0];
				const positions = toJsonCoords(updated);
				setPolygon(positions);
				savePolygon(positions);
			});
		}
	};

	const handleEdited = (e: any) => {
		if (!isMaster) return;
		const layers = e.layers;
		let updatedOnce = false;
		layers.eachLayer((layer: any) => {
			if (typeof layer.getLatLngs === "function") {
				const latlngs = layer.getLatLngs()[0];
				const next = toJsonCoords(latlngs);
				setPolygon(next);
				savePolygon(next);
				updatedOnce = true;
				layer.on("edit", () => {
					const updated = layer.getLatLngs()[0];
					const positions = toJsonCoords(updated);
					setPolygon(positions);
					savePolygon(positions);
				});
			}
		});
		if (!updatedOnce) {
			// no-op
		}
	};

	const handleDeleted = () => {
		if (!isMaster) return;
		setPolygon([]);
		savePolygon([]);
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
					<h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Select Area on Map</h1>
					<Link href="/user-info" className="text-sm text-zinc-600 dark:text-zinc-300 hover:underline">
						Back to user info
					</Link>
				</div>

				<div className="w-full h-[70vh] rounded-lg border border-black/[.08] dark:border-white/[.145] shadow-md overflow-hidden">
					<MapContainer
						center={[24.4539, 54.3773]}
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
						<FeatureGroup>
							{isMaster && (
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
									edit={{
										edit: true,
										remove: true,
									}}
								/>
							)}
							{polygon.length > 0 && (
								<Polygon positions={polygon.map((p) => [p.lat, p.lon]) as any} color="#2563eb" />
							)}
						</FeatureGroup>
					</MapContainer>
				</div>

				{polygon.length > 0 && (
					<pre className="mt-4 p-4 bg-white dark:bg-zinc-9 00 border border-black/[.08] dark:border-white/[.145] rounded-lg text-sm overflow-x-auto text-zinc-900 dark:text-zinc-100">
						{JSON.stringify(polygon, null, 2)}
					</pre>
				)}
			</div>
		</div>
	);
}
