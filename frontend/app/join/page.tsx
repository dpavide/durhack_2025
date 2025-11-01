"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function JoinRoomPage() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const codeUpper = code.trim().toUpperCase();
		try {
			const { data: s } = await supabase.auth.getSession();
			const user = s.session?.user;
			if (!user) {
				router.replace("/");
				return;
			}

			// Room exists?
			const { data: room, error: roomErr } = await supabase
				.from("rooms")
				.select("room_code")
				.eq("room_code", codeUpper)
				.single();
			if (roomErr || !room) {
				setError("Room not found.");
				setLoading(false);
				return;
			}

			// Current count
			const { count, error: countErr } = await supabase
				.from("room_participants")
				.select("user_id", { count: "exact", head: true })
				.eq("room_code", codeUpper);
			if (countErr) throw countErr;

			if ((count ?? 0) >= 3) {
				setError("MeetSpace full.");
				setLoading(false);
				return;
			}

			// Upsert participant (avoid dup if already in)
			const { error: upsertErr } = await supabase.from("room_participants").upsert(
				{
					room_code: codeUpper,
					user_id: user.id,
					is_master: false,
				},
				{ onConflict: "room_code,user_id" }
			);
			if (upsertErr) throw upsertErr;

			router.replace(`/room/${codeUpper}`);
		} catch (err: any) {
			setError(err.message ?? "Failed to join.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
				<form onSubmit={submit} className="w-full max-w-md mx-auto">
					<div className="mb-4">
						<label className="block mb-1 text-sm">Enter Room Code</label>
						<input
							className="w-full rounded-md border border-black/8 px-3 py-2 text-sm dark:border-white/[.145] bg-transparent"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							placeholder="ABC123"
						/>
					</div>
					{error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
					<button
						disabled={loading}
						className="flex h-10 items-center rounded-md border border-black/8 px-4 text-sm transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
					>
						{loading ? "Joining…" : "Join"}
					</button>
				</form>
			</main>
		</div>
	);
}
