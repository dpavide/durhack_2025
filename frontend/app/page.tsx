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

  // Ensure that every signed-in user has a profile row (UNCHANGED)
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
    } catch {
      /* silent */
    }
  };

  // Redirect if already logged in (UNCHANGED)
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session) {
        await ensureProfile(data.session);
        router.replace("/home");
      } else {
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session) {
        await ensureProfile(session);
        router.replace("/home");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) setError(signInErr.message);
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email || !password || !username) {
      setError("Please fill in all required fields.");
      return;
    }
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (signUpErr) setError(signUpErr.message);
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-zinc-950">
        <div className="card bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-6 text-center">
          <svg
            className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
          </svg>
          <p className="text-slate-700 dark:text-slate-200 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-zinc-950">
      {/* Top brand */}
      <header className="container-hero py-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" strokeWidth="2" />
              <circle cx="12" cy="7" r="4" strokeWidth="2" />
            </svg>
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            MeetSpace
          </h1>
        </div>
      </header>

      {/* Auth card */}
      <main className="container-hero pb-24">
        <div className="mx-auto max-w-lg">
          <div className="card bg-white/90 dark:bg-zinc-900/70 backdrop-blur p-8">
            {/* Mode toggle */}
            <div className="mb-6 flex justify-center gap-2">
              <button
                type="button"
                className={`h-10 px-4 rounded-full text-sm font-medium transition ${
                  mode === "signup"
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-gray-50/60"
                }`}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
              <button
                type="button"
                className={`h-10 px-4 rounded-full text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-300 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-gray-50/60"
                }`}
                onClick={() => setMode("login")}
              >
                Login
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block mb-1 text-sm text-slate-600 dark:text-slate-300">Username</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white/70 dark:bg-zinc-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/60"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_username"
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 text-sm text-slate-600 dark:text-slate-300">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white/70 dark:bg-zinc-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/60"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm text-slate-600 dark:text-slate-300">Password</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white/70 dark:bg-zinc-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/60"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
              )}

              <button
                type="button"
                className="btn btn-primary w-full h-11 text-base"
                onClick={mode === "signup" ? handleSignUp : handleLogin}
              >
                {mode === "signup" ? "Sign Up" : "Login"}
              </button>
            </div>

            {/* Helper text */}
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              By continuing you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
