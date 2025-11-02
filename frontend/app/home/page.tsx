"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

/* === Small inline icon unchanged === */
function UserProfileIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* === User menu - unchanged behaviour, restyled container === */
function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const displayEmail = email.includes("@")
    ? email
    : `User: ${email.substring(0, 8)}...`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 backdrop-blur px-3 py-2 text-sm shadow-sm transition hover:bg-white"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <UserProfileIcon className="h-4 w-4" />
        </span>
        <span className="max-w-[200px] truncate font-medium text-gray-800">
          {displayEmail}
        </span>
      </button>

      
    </div>
  );
}

/* === MAIN === */
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <svg
            className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-center font-medium text-gray-700">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_700px_at_10%_0%,#e9ecff_0%,transparent_60%),radial-gradient(900px_600px_at_90%_0%,#f1f5ff_0%,transparent_65%),#f8fafc]">
      {/* Decorative blur blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-300 blur-3xl" />
        <div className="absolute top-0 right-10 h-56 w-56 rounded-full bg-purple-200 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/home" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shadow">
              {/* tiny logo */}
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              MeetSpaces
            </span>
          </Link>

          <div>
            {session ? (
              <UserMenu email={session.user.email ?? session.user.id} />
            ) : (
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-xl border border-gray-300 bg-white/70 px-4 text-sm font-medium text-gray-800 shadow-sm backdrop-blur transition hover:bg-white"
              >
                Sign Up / Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pt-8 pb-14">
          <div className="max-w-4xl">
            <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] font-extrabold leading-[1.05] tracking-tight text-slate-900">
              Start a meeting with anyone, anywhere
            </h1>
            <p className="mt-5 max-w-3xl text-xl text-slate-600">
              Powered by real-time data. Coordinate schedules, manage locations,
              and make any kind of meeting happen.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/create"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Create a MeetSpace
              </Link>
              <Link
                href="/join"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-6 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
              >
                Join a MeetSpace
              </Link>
            </div>
          </div>
        </section>

        {/* Feature trio (optional flair, pure styling) */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">Smart suggestions</h3>
              <p className="mt-2 text-slate-600">
                AI ranks options by fairness, travel time, opening hours & reviews.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">Real-time collaboration</h3>
              <p className="mt-2 text-slate-600">
                Create or join a plan, vote or auto-choose and share instantly.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">Privacy-first</h3>
              <p className="mt-2 text-slate-600">
                Use approximate locations; control exactly what’s shared.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
