export const dynamic = 'force-dynamic';

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

function genRoomCode(len = 6) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}

export default function CreateRoomPage() {
	const router = useRouter();

	useEffect(() => {
		(async () => {
			const { data: s } = await supabase.auth.getSession();
			const user = s.session?.user;
			if (!user) {
				router.replace("/");
				return;
			}

			const code = genRoomCode();
			// Create room
			const { error: roomErr } = await supabase.from("rooms").insert({
				room_code: code,
				master_id: user.id,
				planning_started: false,
				polygon_geojson: null,
			});
			if (roomErr) {
				// Room code collision? Try once more, otherwise bail.
				const retry = genRoomCode();
				const { error: roomErr2 } = await supabase.from("rooms").insert({
					room_code: retry,
					master_id: user.id,
					planning_started: false,
					polygon_geojson: null,
				});
				if (roomErr2) {
					alert("Failed to create room.");
					router.replace("/home");
					return;
				}
				// Add master as participant
				await supabase.from("room_participants").insert({
					room_code: retry,
					user_id: user.id,
					is_master: true,
				});
				router.replace(`/room/${retry}`);
				return;
			}

			// Add master as participant
			await supabase.from("room_participants").insert({
				room_code: code,
				user_id: user.id,
				is_master: true,
			});

			router.replace(`/room/${code}`);
		})();
	}, [router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
				<span className="text-sm text-zinc-500">Creating room…</span>
			</main>
		</div>
	);
}
