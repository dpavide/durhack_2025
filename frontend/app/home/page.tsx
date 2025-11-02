"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// --- ICON COMPONENTS ---
// User/Profile Icon for Menu
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

// --- USER MENU ---
function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  // Fallback email display
  const displayEmail = email.includes("@")
    ? email
    : `User: ${email.substring(0, 8)}...`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-100 shadow-sm text-gray-700"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <UserProfileIcon className="w-4 h-4" />
        </span>
        <span className="max-w-[180px] truncate font-medium">
          {displayEmail}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="py-1">
            <Link
              href="/user-info"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              User info
            </Link>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={async () => {
                await supabase.auth.signOut();
                setOpen(false);
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MAIN COMPONENT ---
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <div className="text-center p-6 bg-white rounded-xl shadow-xl">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3"
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
          <p className="text-gray-700 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        .font-sans { font-family: 'Inter', sans-serif; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <main className="flex min-h-screen w-full max-w-lg flex-col items-center justify-between py-20 px-8 bg-white rounded-2xl shadow-2xl border border-gray-100">
        {/* Top-right controls */}
        <div className="w-full mb-16 flex justify-end gap-3">
          {/* NEW: How it works button */}
          <Link
            href="/how-it-works"
            className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm transition-colors hover:bg-gray-100 shadow-sm text-gray-700 font-medium"
          >
            How it works
          </Link>

          {session ? (
            <UserMenu email={session.user.email ?? session.user.id} />
          ) : (
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-xl border border-gray-300 px-4 text-sm transition-colors hover:bg-gray-100 shadow-sm text-gray-700 font-medium"
            >
              Sign Up / Login
            </Link>
          )}
        </div>

        {/* MeetSpace lobby (Center Content) */}
        <div className="flex flex-col items-center gap-4 text-center mb-20">
          <div className="bg-blue-100 p-4 rounded-full mb-2 shadow-inner">
            <svg
              className="w-12 h-12 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <path d="M18 22a7 7 0 0 0 3-5v-1a4 4 0 0 0-4-4" />
              <circle cx="9" cy="7" r="4" />
              <circle cx="15" cy="9" r="2" />
            </svg>
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
            MeetSpace
          </h1>
          <p className="text-lg text-gray-500 max-w-xs">
            Collaborative planning for your team, powered by real-time data.
          </p>
        </div>

        {/* Action Buttons (Bottom) */}
        <div className="flex w-full flex-col gap-4 text-base font-medium">
          <Link
            className="flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-white shadow-lg transition-colors hover:bg-blue-700 text-lg font-semibold"
            href="/create"
          >
            Create a MeetSpace
          </Link>
          <Link
            className="flex h-14 w-full items-center justify-center rounded-xl border border-gray-300 px-5 text-gray-700 transition-colors hover:bg-gray-100 shadow-md text-lg font-semibold"
            href="/join"
          >
            Join a MeetSpace
          </Link>
        </div>
      </main>
    </div>
  );
}
