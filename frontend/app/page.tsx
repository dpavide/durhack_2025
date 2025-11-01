"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthLanding() {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [mode, setMode] = useState<"login" | "signup">("signup");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	const ensureProfile = async (session: any) => {
		try {
			const user = session?.user;
			if (!user) return;
			const uname =
				(user.user_metadata && user.user_metadata.username) ||
				(user.email ? user.email.split("@")[0] : `user_${user.id.slice(0, 6)}`);
			const { error: upsertErr } = await supabase.from("profiles").upsert(
				{
					id: user.id,
					username: uname,
					email: user.email,
				},
				{ onConflict: "id" }
			);
			if (upsertErr && upsertErr.code !== "23505") throw upsertErr;
		} catch (e) {
			// Silent fail to avoid blocking redirect
		}
	};

	useEffect(() => {
		supabase.auth.getSession().then(async ({ data }) => {
			if (data.session) {
				await ensureProfile(data.session);
				return router.replace("/home");
			}
			setLoading(false);
		});
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_e, session) => {
			if (session) {
				await ensureProfile(session);
				router.replace("/home");
			}
		});
		return () => subscription.unsubscribe();
	}, [router]);

	const handleLogin = async () => {
		setError(null);
		if (!email || !password) {
			setError("Please fill in all required fields.");
			return;
		}
		try {
			const { error: signInErr } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (signInErr) throw signInErr;
		} catch (err: any) {
			setError(err.message ?? "Authentication failed.");
		}
	};

	const handleSignUp = async () => {
		setError(null);
		if (!email || !password || !username) {
			setError("Please fill in all required fields.");
			return;
		}
		try {
			const { error: signUpErr } = await supabase.auth.signUp({
				email,
				password,
				options: { data: { username } },
			});
			if (signUpErr) throw signUpErr;
		} catch (err: any) {
			setError(err.message ?? "Authentication failed.");
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
				<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
					<span className="text-sm text-zinc-500">Loading…</span>
				</main>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
				<div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left mb-8">
					<h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
						MeetSpace
					</h1>
				</div>

				<div className="w-full max-w-md mx-auto space-y-6">
					<div className="flex gap-2 justify-center">
						<button
							type="button"
							className={`flex h-10 items-center rounded-md px-4 text-sm transition-colors ${
								mode === "signup"
									? "bg-black text-white dark:bg-white dark:text-black"
									: "border border-black/8 hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
							}`}
							onClick={() => setMode("signup")}
						>
							Sign Up
						</button>
						<button
							type="button"
							className={`flex h-10 items-center rounded-md px-4 text-sm transition-colors ${
								mode === "login"
									? "bg-black text-white dark:bg-white dark:text-black"
									: "border border-black/8 hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
							}`}
							onClick={() => setMode("login")}
						>
							Login
						</button>
					</div>

					<div className="space-y-4">
						{mode === "signup" && (
							<div>
								<label className="block mb-1 text-sm">Username</label>
								<input
									className="w-full rounded-md border border-black/8 px-3 py-2 text-sm dark:border-white/[.145] bg-transparent"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="your_username"
								/>
							</div>
						)}
						<div>
							<label className="block mb-1 text-sm">Email</label>
							<input
								type="email"
								className="w-full rounded-md border border-black/8 px-3 py-2 text-sm dark:border-white/[.145] bg-transparent"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
							/>
						</div>
						<div>
							<label className="block mb-1 text-sm">Password</label>
							<input
								type="password"
								className="w-full rounded-md border border-black/8 px-3 py-2 text-sm dark:border-white/[.145] bg-transparent"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
							/>
						</div>

						{error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

						<button
							type="button"
							className="w-full flex h-10 items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black px-4 text-sm transition-colors hover:opacity-90"
							onClick={mode === "signup" ? handleSignUp : handleLogin}
						>
							{mode === "signup" ? "Sign Up" : "Login"}
						</button>
					</div>
				</div>
			</main>
		</div>
	);
}
