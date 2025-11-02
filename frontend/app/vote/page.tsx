"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";

export default function VotePage() {
  const params = useSearchParams();
  const sessionId = params.get("session");
  const [user, setUser] = useState<any>(null);
  const [pins, setPins] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    loadPins();
    const channel = supabase
      .channel(`votes:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_votes" },
        () => loadVotes()
      )
      .subscribe();
    loadVotes();
    return () => supabase.removeChannel(channel);
  }, [sessionId]);

  async function loadPins() {
    const { data } = await supabase
      .from("player_selections")
      .select("selections")
      .eq("session_id", sessionId);

    const allPins = data.flatMap((d: any) => d.selections);
    const uniquePins = Array.from(
      new Map(
        allPins.map((p: any) => [`${p.name}-${p.lat}-${p.lon}`, p])
      ).values()
    );
    setPins(uniquePins);
  }

  async function loadVotes() {
    const { data } = await supabase
      .from("place_votes")
      .select("*")
      .eq("room_code", sessionId);
    setVotes(data || []);
  }

  async function submitVote() {
    if (!selected || !user) return;
    await supabase.from("place_votes").upsert({
      room_code: sessionId,
      user_id: user.id,
      selected_place: selected.name || `${selected.lat},${selected.lon}`,
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white p-6">
      <h1 className="text-3xl font-semibold mb-6">Vote for your favorite spot</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {pins.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className={`rounded-xl border p-4 text-center transition ${
              selected?.id === p.id
                ? "bg-green-600 text-white"
                : "border-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <div className="font-medium">{p.name || "Unnamed"}</div>
            <div className="text-xs text-zinc-500">
              {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={submitVote}
        disabled={!selected}
        className="bg-green-600 text-white px-6 py-3 rounded-full hover:bg-green-700 disabled:opacity-40"
      >
        Submit Vote
      </button>

      <p className="mt-4 text-sm text-zinc-500">
        {votes.length} votes submitted
      </p>
    </div>
  );
}
