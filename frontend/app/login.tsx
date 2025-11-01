"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BUCKET = "user-uploads"; // ensure this bucket exists in Supabase

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // storage demo
  const [file, setFile] = useState<File | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [files, setFiles] = useState<{ name: string }[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your signup.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) router.replace("/");
      }
    } catch (e: any) {
      setErr(e.message || "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!session || !file) return;
    setErr(null);
    setMsg(null);
    setSignedUrl(null);
    setLoading(true);
    try {
      const path = `${session.user.id}/${file.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;

      // ask backend for signed download url
      const res = await fetch(`${API_BASE}/api/storage/sign-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: BUCKET, path, expires_in: 3600 })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to sign URL");
      setSignedUrl(json.url);

      // refresh list
      await handleList();
      setMsg("Uploaded successfully.");
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleList = async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_BASE}/api/storage/list?bucket=${encodeURIComponent(BUCKET)}&prefix=${encodeURIComponent(session.user.id)}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "List failed");
      setFiles(json.files || []);
    } catch (e) {
      // ignore listing errors for brevity
    }
  };

  useEffect(() => {
    if (session) handleList();
  }, [session]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-zinc-900 p-6">
        {!session ? (
          <>
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            {msg && <div className="mb-3 text-sm text-green-600">{msg}</div>}
            {err && <div className="mb-3 text-sm text-red-600">{err}</div>}
            <form onSubmit={handleAuth} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-transparent"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-transparent"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-md border border-black/[.08] px-4 text-sm transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Sign up"}
              </button>
            </form>
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-3 text-sm text-blue-600"
            >
              {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                Signed in as {session.user.email || session.user.id}
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-black/[.08] px-3 py-1.5 text-sm hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Sign out
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full h-10 rounded-md border border-black/[.08] px-4 text-sm transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                {loading ? "Uploading..." : "Upload to Storage"}
              </button>

              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="block text-sm text-blue-600">
                  Open signed download URL
                </a>
              )}

              <div>
                <div className="text-sm font-medium mb-2">Your files</div>
                <ul className="list-disc pl-5 text-sm">
                  {files.map((f) => (
                    <li key={f.name}>{f.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
