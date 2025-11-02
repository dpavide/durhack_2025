"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation"; // ✅ import router

// Minimal Supabase client for the browser
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-black/8 px-3 py-2 text-sm transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className="text-zinc-700 dark:text-zinc-300"
          >
            <path
              fill="currentColor"
              d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"
            />
          </svg>
        </span>
        <span className="max-w-[180px] truncate">{email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 rounded-md border border-black/8 bg-white shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          <div className="py-1">
            <Link
              href="/user-info"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-black/4 dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
            >
              User info
            </Link>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-black/4 dark:text-zinc-300 dark:hover:bg-[#1a1a1a]"
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

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); // ✅ add router

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);

      // ✅ redirect if logged in
      if (data.session) {
        router.replace("/home");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) router.replace("/home"); // ✅ also redirect if session changes
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) return null; // or a loading spinner

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="w-full mb-8 flex justify-end">
          {session ? (
            <UserMenu email={session.user.email ?? session.user.id} />
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-md border border-black/8 px-4 text-sm transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Sign Up / Login
            </Link>
          )}
        </div>
        {/* Your homepage content */}
      </main>
    </div>
  );
}
