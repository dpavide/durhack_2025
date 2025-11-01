"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Participant = {
	user_id: string;
	is_master: boolean;
	profiles: { username: string } | null;
};

export default function WaitingRoomPage() {
	const router = useRouter();
	const params = useParams<{ code: string }>();
	const code = (params?.code ?? "").toString().toUpperCase();

	const [userId, setUserId] = useState<string | null>(null);
	const [masterId, setMasterId] = useState<string | null>(null);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const isMaster = useMemo(() => userId && masterId && userId === masterId, [userId, masterId]);

	// Load session and initial data
	useEffect(() => {
		(async () => {
			const { data: s } = await supabase.auth.getSession();
			const u = s.session?.user;
			if (!u) {
				router.replace("/");
				return;
			}
			setUserId(u.id);

			// room info
			const { data: room, error: roomErr } = await supabase
				.from("rooms")
				.select("master_id, planning_started")
				.eq("room_code", code)
				.single();
			if (roomErr || !room) {
				alert("Room not found.");
				router.replace("/home");
				return;
			}
			setMasterId(room.master_id);
			if (room.planning_started) {
				router.replace(`/map/${code}`);
				return;
			}

			// initial participants with usernames
			await refreshParticipants();
		})();

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [code, router]);

	const refreshParticipants = async () => {
		const { data, error } = await supabase
			.from("room_participants")
			.select("user_id,is_master,profiles:profiles!room_participants_user_id_fkey(username)")
			.eq("room_code", code)
			.order("is_master", { ascending: false });
		if (!error && data) {
			setParticipants(
				data.map((p: any) => ({
					user_id: p.user_id,
					is_master: p.is_master,
					profiles: p.profiles ?? null,
				}))
			);
		}
	};

	// Realtime: participants and planning_started
	useEffect(() => {
		if (!code) return;
		const channel = supabase
			.channel(`room-${code}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${code}` },
				() => refreshParticipants()
			)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
				(payload) => {
					const planningStarted = (payload.new as any)?.planning_started;
					if (planningStarted) router.replace(`/map/${code}`);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [code, router]);

	const beginPlanning = async () => {
		const { error } = await supabase
			.from("rooms")
			.update({ planning_started: true })
			.eq("room_code", code)
			.eq("master_id", userId); // only master can trigger
		if (error) alert("Failed to start planning.");
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-32 px-16 bg-white dark:bg-black sm:items-start">
				<div className="mb-6">
					<h2 className="text-xl font-semibold text-black dark:text-zinc-50">Waiting Room</h2>
					<p className="text-sm text-zinc-600 dark:text-zinc-300">Room Code: {code}</p>
				</div>
				<div className="w-full max-w-md">
					<h3 className="mb-2 text-sm font-medium">Participants</h3>
					<ul className="list-disc pl-6">
						{participants.map((p) => (
							<li key={p.user_id} className="text-sm">
								{p.profiles?.username ?? p.user_id}
								{p.is_master ? " (master)" : ""}
							</li>
						))}
					</ul>
				</div>
				<div className="mt-6">
					<button
						onClick={beginPlanning}
						disabled={!isMaster}
						className="flex h-10 items-center rounded-md border border-black/8 px-4 text-sm transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a] disabled:opacity-60"
					>
						Begin Planning
					</button>
				</div>
			</main>
		</div>
	);
}
