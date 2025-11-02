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
  // Added from player_selections 'pin' type, in case gmap fails
  lat?: number; 
  lon?: number;
};

// This is the type of the 'pin' object stored in player_selections.selections
type SelectionPin = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  tags?: Record<string, string>;
  source?: "json" | "user";
};

export default function ListingsPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [userId, setUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string }[]>([]);
  const [votes, setVotes] = useState<{ user_id: string; place_id: string }[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // place_id -> expanded?

  // --- NEW: State for dynamically fetched places ---
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- REMOVED: useMemo for places (was hardcoded) ---

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
    if (total === 0 || places.length === 0) return null; // Guard for no participants/places
    for (const pid of placeIdList) {
      if ((voteCounts.get(pid) ?? 0) >= total) return pid;
    }
    return null;
  }, [participants.length, placeIdList, voteCounts, places.length]);

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

  // --- UPDATED: Function to fetch and process listings ---
  const fetchListings = useCallback(async (roomCode: string) => {
    if (!roomCode) return;
    
    try {
      // 1. Fetch all selections for the room
      const { data: selectionsData, error: selectionsError } = await supabase
        .from("player_selections")
        .select("selections")
        .eq("session_id", roomCode);

      if (selectionsError) throw new Error(`Supabase error: ${selectionsError.message}`);
      if (!selectionsData || selectionsData.length === 0) {
        throw new Error("No player selections found for this session.");
      }

      // 2. Process and de-duplicate
      const allSelections: SelectionPin[] = selectionsData.flatMap((row: any) => row.selections || []);
      const uniquePlacesMap = new Map<string, SelectionPin>();
      for (const place of allSelections) {
        if (place && place.id) {
          uniquePlacesMap.set(String(place.id), place);
        }
      }
      const uniquePlaces = Array.from(uniquePlacesMap.values());
      
      if (uniquePlaces.length === 0) {
          setError("No places were selected by the group.");
          setPlaces([]);
          return;
      }

      // 3. Fetch detailed GMap data for each unique place
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

      const gmapApiFetches = uniquePlaces.map(async (place) => { // Make async
        const params = new URLSearchParams({
          name: place.name || "Location", // GMap API needs a name
          lat: place.lat.toString(),
          lng: place.lon.toString(),
          radius: "50" // Small radius since we have exact coords
        });
        const url = `${BACKEND_BASE}/api/gmap/search?${params.toString()}`;
        
        try {
          const res = await fetch(url);
          if (res.ok) {
            const gmapData = await res.json();
            // *** FIX ***: Merge GMap data ONTO the original place
            // This ensures we keep 'place.id' as a fallback
            return { ...place, ...gmapData };
          }
          // GMap search failed, return basic info, ensuring 'element_id' is set
          console.warn(`GMap search failed for ${place.name} (status: ${res.status})`);
          return { ...place, element_id: place.id, reviews: [], rating: null };
        } catch (e) {
          console.error(`Failed to fetch GMap data for ${place.name}:`, e);
          // On fetch error, also return basic info
          return { ...place, element_id: place.id, reviews: [], rating: null };
        }
      });

      const gmapResults = await Promise.all(gmapApiFetches);

      // 4. Format and set state
      const formattedPlaces: Place[] = gmapResults.map((p: any) => ({
        // *** FIX ***: Prioritize gmap's element_id, but ALWAYS fall back to p.id
        // (which is the original SelectionPin 'id')
        element_id: String(p.element_id ?? p.id), 
        name: p.name ?? "Unknown Location",
        rating: p.rating,
        reviews: p.reviews || [],
        lat: p.lat,
        lon: p.lon,
      }));
  
      setPlaces(formattedPlaces);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching listings:", err);
      setError(err.message || "Failed to load listings.");
    }
  }, []); // Empty dependency array, it's a stable function

  // --- UPDATED: Main useEffect to run all fetches ---
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const u = s.session?.user;
      if (!u) {
        router.replace("/");
        return;
      }
      setUserId(u.id);
      
      setLoading(true);
      setError(null);
      await Promise.all([
        refreshParticipants(), 
        refreshVotes(),
        fetchListings(code) // 'code' is from useParams, stable here
      ]);
      setLoading(false);
    })();
  }, [code, router, refreshParticipants, refreshVotes, fetchListings]);

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

  // --- UPDATED: Loading and Error States ---
  if (loading) {
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <script src="https://cdn.tailwindcss.com"></script>
         <div className="text-center p-6 bg-white rounded-xl shadow-xl">
           <p className="text-red-600 font-medium">Error: {error}</p>
         </div>
      </div>
    );
  }
  
  if (places.length === 0) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <script src="https://cdn.tailwindcss.com"></script>
         <div className="text-center p-6 bg-white rounded-xl shadow-xl">
            <p className="text-gray-700 font-medium">No places found for this session.</p>
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
            const pid = String(place.element_id); // This line is now safe
            const isOpen = !!expanded[pid];
            const votesForPlace = voteCounts.get(pid) ?? 0;
            const hasReviews = place.reviews && place.reviews.length > 0;

            return (
              <div key={pid} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row: name + rating */}
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{place.name}</h2>
                      <div className="shrink-0 text-sm sm:text-base text-gray-700">
                        Rating: <span className="font-semibold">{place.rating ?? "N/A"}</span>
                      </div>
                    </div>

                    {/* Reviews toggle */}
                    {hasReviews ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [pid]: !e[pid] }))}
                        className="mt-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-2"
                      >
                        <Arrow dir={isOpen ? "down" : "right"} />
                        <span>Read Reviews</span>
                      </button>
                    ) : (
                       <p className="mt-1 text-xs sm:text-sm text-gray-500">No reviews available</p>
                    )}

                    {/* Reviews section */}
                    {isOpen && hasReviews && (
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