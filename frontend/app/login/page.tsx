"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type Session } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// I am waiting for szymon to finish so I can do frontend-h integration 
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) router.replace("/");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.replace("/user-info");
        return;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          const text = (error.message || "").toLowerCase().includes("invalid")
            ? "Invalid credentials or email not confirmed. If you just signed up, confirm via the email sent to you."
            : error.message;
          throw new Error(text);
        }
        if (data.session) router.replace("/");
      }
    } catch (e: any) {
      setErr(e.message || "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    setErr(null);
    setMsg(null);
    if (!email) {
      setErr("Enter your email above, then click Resend.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      setMsg("Confirmation email resent. Check your inbox.");
    } catch (e: any) {
      setErr(e.message || "Failed to resend confirmation email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-lg border border-black/8 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>

        {msg && <div className="mb-3 text-sm text-green-600">{msg}</div>}
        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
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
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 bg-transparent"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md border border-black/8 px-4 text-sm transition-colors hover:border-transparent hover:bg-black/4"
          >
            {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            onClick={resendConfirmation}
            disabled={loading}
            className="mt-3 text-sm text-blue-600"
          >
            Resend confirmation email
          </button>
        )}

        <div className="mt-4">
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-blue-600"
          >
            {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>

        <a href="/" className="mt-4 block text-sm text-zinc-600">
          Back to home
        </a>
      </div>
    </div>
  );
}
