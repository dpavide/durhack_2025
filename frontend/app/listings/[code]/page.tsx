"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// Simple arrow and button icons
const Arrow = ({ dir = "right", className = "" }: { dir?: "right" | "down"; className?: string }) => (
  <span className={className} aria-hidden>
    {dir === "right" ? "→" : "↓"}
  </span>
);

// Sample JSON data. Replace with a fetch if needed.
const SAMPLE_DATA = {
  gmap_results: [
    {
      element_id: 313076158,
      osm_type: "node",
      name: "La Spaghettata",
      lat: 54.7761448,
      lon: -1.5750704,
      rating: 4.4,
      reviews: [
        {
          author_name: "little girl",
          author_url: "https://www.google.com/maps/contrib/106717110483583966010/reviews",
          rating: 5,
          relative_time_description: "3 weeks ago",
          time: 1759913068,
          text:
            "A lovely Italian restaurant with amazing food! The spaghetti is super delicious, the pizza is great, and the desserts are absolutely delightful. The atmosphere is warm and cozy — perfect for a meal with friends, a date, or even family. The service is excellent too. Definitely one of my favorite spots!",
        },
        {
          author_name: "Lauren Winslow",
          author_url: "https://www.google.com/maps/contrib/105458315474297976828/reviews",
          rating: 5,
          relative_time_description: "2 months ago",
          time: 1754763714,
          text:
            "Very tasty Italian food with lots of flavour. The portions were very generous. I opted for pasta with breaded chicken which was cooked beautifully. Lots of gluten free options available. Service was friendly but a tad rushed. We did go on a busy Friday night though.",
        },
      ],
      found_on_gmaps: true,
    },
    {
      element_id: 391426639,
      osm_type: "node",
      name: "Jozef’s Riverside Bar & Restaurant",
      lat: 54.7806277,
      lon: -1.57676,
      rating: 4,
      reviews: [
        {
          author_name: "Andreea Visan",
          author_url: "https://www.google.com/maps/contrib/104528458061531317586/reviews",
          rating: 5,
          relative_time_description: "a year ago",
          time: 1725499947,
          text:
            "We went for an afternoon tea and a spa day at Raddison Blu Hotel, and as always, had been a great experience. They refurbished the restaurant, and it looks so great. The spa day was really nice, too. Shout out to the massage therapists Clare L and Janine, who were very good. Ladies, you made our day! Thank you!! ❤",
        },
        {
          author_name: "Sean Ellis",
          author_url: "https://www.google.com/maps/contrib/115810686233235202375/reviews",
          rating: 5,
          relative_time_description: "3 years ago",
          time: 1644697924,
          text: "Great dinner. Enjoyed the new Valentines set menu. Food and service was great.",
        },
      ],
      found_on_gmaps: true,
    },
    {
      element_id: 940823093,
      osm_type: "node",
      name: "Inshanghai",
      lat: 54.7765249,
      lon: -1.5783341,
      rating: 4.2,
      reviews: [
        {
          author_name: "大白",
          author_url: "https://www.google.com/maps/contrib/113039611867534865137/reviews",
          rating: 5,
          relative_time_description: "2 weeks ago",
          time: 1760452925,
          text:
            "Great buffet spot! Tasty food, decent prices and really good value. The staff are lovely and the place is super clean. Definitely worth a visit!",
        },
        {
          author_name: "Babs Babs",
          author_url: "https://www.google.com/maps/contrib/101433001068816239284/reviews",
          rating: 5,
          relative_time_description: "2 months ago",
          time: 1756568470,
          text:
            "We stopped here for lunch in between sightseeing in Durham (after the Cathedral and the Oriental Museum) and it was just what we needed! 🥢🍜\nThe food was fresh, tasty, and full of flavour, with a good variety to choose from. Service was quick and friendly, and the atmosphere felt relaxed – perfect for recharging after a busy morning of exploring.\nDefinitely a great spot to add to your Durham trip. I’ll remember this place not just for the food, but for saving two very hungry explorers! 😅",
        },
      ],
      found_on_gmaps: true,
    },
  ],
};

type Place = {
  element_id: number | string;
  name: string;
  rating?: number;
  reviews?: {
    author_name: string;
    author_url?: string;
    rating?: number;
    relative_time_description?: string;
    text?: string;
  }[];
};

export default function ListingsPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [userId, setUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string }[]>([]);
  const [votes, setVotes] = useState<{ user_id: string; place_id: string }[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // place_id -> expanded?

  const places: Place[] = useMemo(() => {
    return (SAMPLE_DATA?.gmap_results ?? []).map((p: any) => ({
      element_id: String(p.element_id),
      name: p.name,
      rating: p.rating,
      reviews: p.reviews || [],
    }));
  }, []);

  const placeIdList = useMemo(() => places.map((p) => String(p.element_id)), [places]);

  const voteCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const pid of placeIdList) map.set(pid, 0);
    for (const v of votes) {
      map.set(v.place_id, (map.get(v.place_id) ?? 0) + 1);
    }
    return map;
  }, [votes, placeIdList]);

  const userHasVoted = useMemo(() => {
    if (!userId) return false;
    return votes.some((v) => v.user_id === userId);
  }, [votes, userId]);

  const winningPlaceId = useMemo(() => {
    const total = participants.length;
    if (total === 0) return null;
    for (const pid of placeIdList) {
      if ((voteCounts.get(pid) ?? 0) >= total) return pid;
    }
    return null;
  }, [participants.length, placeIdList, voteCounts]);

  const refreshParticipants = useCallback(async () => {
    if (!code) return;
    const { data, error } = await supabase
      .from("room_participants")
      .select("user_id")
      .eq("room_code", code);
    if (!error && data) setParticipants(data as any);
  }, [code]);

  const refreshVotes = useCallback(async () => {
    if (!code) return;
    const { data, error } = await supabase
      .from("place_votes")
      .select("user_id, place_id")
      .eq("room_code", code);
    if (!error && data) {
      setVotes(
        (data as any[]).map((r) => ({
          user_id: r.user_id,
          place_id: String(r.place_id),
        }))
      );
    }
  }, [code]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const u = s.session?.user;
      if (!u) {
        router.replace("/");
        return;
      }
      setUserId(u.id);
      await Promise.all([refreshParticipants(), refreshVotes()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, router]);

  // Realtime sync for participants and votes
  useEffect(() => {
    if (!code) return;

    const participantsCh = supabase
      .channel(`listings-participants-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${code}` },
        () => refreshParticipants()
      )
      .subscribe();

    const votesCh = supabase
      .channel(`listings-votes-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_votes", filter: `room_code=eq.${code}` },
        () => refreshVotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsCh);
      supabase.removeChannel(votesCh);
    };
  }, [code, refreshParticipants, refreshVotes]);

  // Redirect when any place reaches unanimous votes
  useEffect(() => {
    if (winningPlaceId) {
      router.replace(`/result/${code}`);
    }
  }, [winningPlaceId, router, code]);

  const handleVote = async (place_id: string) => {
    if (!userId || !code || userHasVoted) return;
    const { error } = await supabase
      .from("place_votes")
      .upsert(
        { room_code: code, user_id: userId, place_id },
        { onConflict: "room_code,user_id", ignoreDuplicates: false }
      );
    if (error) {
      console.error("Vote error:", error);
      return;
    }
    // optimistic update
    setVotes((prev) => [...prev, { user_id: userId, place_id }]);
  };

  if (!userId || participants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <script src="https://cdn.tailwindcss.com"></script>
        <div className="text-center p-6 bg-white rounded-xl shadow-xl">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-700 font-medium">Loading listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <header className="p-4 bg-white shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">
            Listings for <span className="text-blue-600">{code}</span>
          </h1>
          <div className="text-sm text-gray-600">
            Users: <span className="font-semibold">{participants.length}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        <div className="space-y-4">
          {places.map((place) => {
            const pid = String(place.element_id);
            const isOpen = !!expanded[pid];
            const votesForPlace = voteCounts.get(pid) ?? 0;

            return (
              <div key={pid} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row: name + rating */}
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{place.name}</h2>
                      <div className="shrink-0 text-sm sm:text-base text-gray-700">
                        Rating: <span className="font-semibold">{place.rating ?? "-"}</span>
                      </div>
                    </div>

                    {/* Reviews toggle */}
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [pid]: !e[pid] }))}
                      className="mt-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-2"
                    >
                      <Arrow dir={isOpen ? "down" : "right"} />
                      <span>Read Some Reviews</span>
                    </button>

                    {/* Reviews section */}
                    {isOpen && (
                      <div className="mt-3 space-y-3">
                        {(place.reviews ?? []).slice(0, 2).map((r, idx) => (
                          <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <div className="truncate">
                                <span className="font-semibold">{r.author_name}</span>
                                {r.rating != null && <span className="ml-2">({r.rating}★)</span>}
                              </div>
                              {r.relative_time_description && <span className="ml-3 shrink-0">{r.relative_time_description}</span>}
                            </div>
                            {r.text && <p className="mt-1 text-sm text-gray-800 whitespace-pre-line">{r.text}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vote button */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      disabled={userHasVoted}
                      onClick={() => handleVote(pid)}
                      className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
                        userHasVoted ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                      title={userHasVoted ? "You have already voted" : "Vote for this place"}
                    >
                      Vote
                    </button>
                    <div className="mt-2 text-xs text-gray-600 text-center">
                      {votesForPlace}/{participants.length} votes
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Dummy "Ask Gemini" button */}
      <button
        type="button"
        onClick={() => alert("Ask Gemini (coming soon)")}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold"
      >
        Ask Gemini
      </button>
    </div>
  );
}
