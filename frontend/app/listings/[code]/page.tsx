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

// New Checkmark Icon for UI
const Checkmark = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Types remain the same
type Place = {
  element_id: number | string;
  name: string;
  rating?: number | null;
  reviews?: {
    author_name?: string;
    author_url?: string;
    rating?: number | null;
    relative_time_description?: string;
    text?: string;
  }[];
  lat?: number; 
  lon?: number;
};

type SelectionPin = {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  tags?: Record<string, string>;
  source?: "json" | "user";
};

// --- MAIN COMPONENT ---
export default function ListingsPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  const [userId, setUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string }[]>([]);
  const [votes, setVotes] = useState<{ user_id: string; place_id: string }[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Gemini / AI UI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiChosenIndex, setAiChosenIndex] = useState<number | null>(null); // index (0-based) chosen by AI
  const [aiResponseText, setAiResponseText] = useState<string | null>(null);
  const [aiSavedFilename, setAiSavedFilename] = useState<string | null>(null);

  // --- NEW: Track the user's current vote ID ---
  // State for animation control
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);

  const userVoteId = useMemo(() => {
    if (!userId) return null;
    const vote = votes.find((v) => v.user_id === userId);
    return vote ? vote.place_id : null;
  }, [votes, userId]);

  const placeIdList = useMemo(() => places.map((p) => String(p.element_id)), [places]);

  const voteCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const pid of placeIdList) map.set(pid, 0);
    for (const v of votes) {
      map.set(v.place_id, (map.get(v.place_id) ?? 0) + 1);
    }
    return map;
  }, [votes, placeIdList]);

  // Find the winning place ID (unanimous vote check)
  const winningPlaceId = useMemo(() => {
    const total = participants.length;
    if (total === 0 || places.length === 0) return null; 
    
    for (const pid of placeIdList) {
      // Check for unanimous vote (votes === total participants)
      if ((voteCounts.get(pid) ?? 0) === total) return pid;
    }
    return null;
  }, [participants.length, placeIdList, voteCounts, places.length]);
  
  // Find the winning place object
  const winningPlace = useMemo(() => {
    return places.find(p => String(p.element_id) === winningPlaceId) || null;
  }, [places, winningPlaceId]);


  // --- Data Fetchers (unchanged for brevity) ---
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
  
  const fetchListings = useCallback(async (roomCode: string) => {
    if (!roomCode) return;
    setLoading(true);
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

      // 3. Fetch detailed GMap data for each unique place (omitted implementation for brevity, logic remains the same)
      const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

      const gmapApiFetches = uniquePlaces.map(async (place) => { 
        const params = new URLSearchParams({
          name: place.name || "Location", 
          lat: String(place.lat ?? 0),
          lng: String(place.lon ?? 0),
          radius: "50"
        });
        const url = `${BACKEND_BASE}/api/gmap/search?${params.toString()}`;
        const { data: selectionsData } = await supabase.from("player_selections").select("selections").eq("session_id", roomCode);
        const allSelections: SelectionPin[] = (selectionsData || []).flatMap((row: any) => row.selections || []);
        
        const uniquePlacesMap = new Map<string, SelectionPin>();
        for (const place of allSelections) {
            if (place && place.id) uniquePlacesMap.set(String(place.id), place);
        }
        const uniquePlaces = Array.from(uniquePlacesMap.values());

        if (uniquePlaces.length === 0) {
            setError("No places were selected by the group.");
            setPlaces([]);
            return;
        }

        const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");
        const gmapApiFetches = uniquePlaces.map(async (place) => { 
            const params = new URLSearchParams({ name: place.name || "Location", lat: place.lat.toString(), lng: place.lon.toString(), radius: "50" });
            const url = `${BACKEND_BASE}/api/gmap/search?${params.toString()}`;
            try {
              const res = await fetch(url);
              if (res.ok) {
                const gmapData = await res.json();
                return { ...place, ...gmapData };
              }
              return { ...place, element_id: place.id, reviews: [], rating: null };
            } catch (e) {
              return { ...place, element_id: place.id, reviews: [], rating: null };
            }
        });

        const gmapResults = await Promise.all(gmapApiFetches);

        const formattedPlaces: Place[] = gmapResults.map((p: any) => ({
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
        setError(err.message || "Failed to load listings.");
    } finally {
        setLoading(false);
    }
  }, []);

  // Initialization (unchanged for brevity)
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) {
        router.replace("/");
        return;
      }
      setUserId(s.session.user.id);
      
      await Promise.all([
        refreshParticipants(), 
        refreshVotes(),
        fetchListings(code) 
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, router]);

  // Realtime Sync (This ensures all clients get the updated vote counts)
  useEffect(() => {
    if (!code) return;

    const participantsCh = supabase
      .channel(`listings-participants-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${code}` }, () => refreshParticipants())
      .subscribe();

    const votesCh = supabase
      .channel(`listings-votes-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "place_votes", filter: `room_code=eq.${code}` }, () => refreshVotes())
      .subscribe();

    return () => {
      supabase.removeChannel(participantsCh);
      supabase.removeChannel(votesCh);
    };
  }, [code, refreshParticipants, refreshVotes]);
  
  // --- CRITICAL FIX: Animation and Redirection Logic ---
  useEffect(() => {
    // Check for the winning condition
    if (winningPlaceId) {
      // If the animation hasn't started yet, start it.
      if (!showWinnerAnimation) {
        setShowWinnerAnimation(true);
      }
      
      // Set the delayed redirect (3 seconds for animation to play)
      const timer = setTimeout(() => {
        // Corrected path to result page
        router.replace(`/result/${code}`); 
      }, 3000); 

      return () => clearTimeout(timer);
    }
    // If the winningPlaceId is null, but the animation was previously shown, reset the state.
    // This handles the case where the winner unvotes, but generally shouldn't happen here.
    if (!winningPlaceId && showWinnerAnimation) {
         setShowWinnerAnimation(false);
    }
  }, [winningPlaceId, showWinnerAnimation, router, code]);

  // Vote/Unvote Handler (unchanged for brevity)
  const handleVote = async (place_id: string) => {
    if (!userId || !code || showWinnerAnimation) return;
    
    const isUnvoting = userVoteId === place_id;

    if (isUnvoting) {
      await supabase.from("place_votes").delete().eq("room_code", code).eq("user_id", userId);
      // Removed optimistic update to rely fully on the Realtime listener for vote changes
    } else {
      await supabase.from("place_votes").upsert({ room_code: code, user_id: userId, place_id }, { onConflict: "room_code,user_id", ignoreDuplicates: false });
      // Removed optimistic update to rely fully on the Realtime listener for vote changes
    }
    
    // Explicitly call refresh to update the local state immediately
    // to improve responsiveness, although Realtime should handle it shortly after.
    await refreshVotes();
  };

  // --- RENDER LOGIC ---
  if (loading) {
    // ... Loading state remains the same
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

  if (error || places.length === 0) {
    // ... Error state remains the same
    const message = error || "No places found for this session.";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <script src="https://cdn.tailwindcss.com"></script>
         <div className="text-center p-6 bg-white rounded-xl shadow-xl">
           <p className={`font-medium ${error ? 'text-red-600' : 'text-gray-700'}`}>{message}</p>
         </div>
      </div>
    );
  }

  // --- RENDER WITH ANIMATION ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-hidden">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        /* Standard Spin */
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        /* New: Confetti Keyframes (More dynamic) */
        @keyframes confetti-fall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
            position: absolute;
            width: 8px; /* Slightly smaller base size */
            height: 8px;
            opacity: 0;
            animation: confetti-fall 3s cubic-bezier(0.5, 0.1, 0.5, 1) forwards; /* Smoother fall */
            filter: drop-shadow(0 0 1px rgba(0,0,0,0.2));
        }

        /* Winner Slide-In Keyframes */
        @keyframes winner-slide-in {
            0% { opacity: 0; transform: translateY(-50px) scale(0.9); }
            50% { opacity: 1; transform: translateY(0px) scale(1.05); }
            100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        .animate-winner-slide {
            animation: winner-slide-in 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
        }

        /* Background Blur */
        .blur-background {
            filter: blur(5px);
            transition: filter 0.5s;
        }
      `}</style>
      
      {/* 1. Animation Overlay (Visible when winner is chosen) */}
      {showWinnerAnimation && winningPlace && (
        <>
          {/* Confetti container (Fixed position, high z-index) */}
          <div className="fixed inset-0 z-40 pointer-events-none">
            {/* Increased Confetti Count to 150 */}
            {Array.from({ length: 150 }).map((_, i) => (
              <div 
                key={i} 
                className="confetti-piece rounded-full"
                style={{
                  left: `${Math.random() * 100}vw`,
                  width: `${5 + Math.random() * 8}px`, /* Random size */
                  height: `${5 + Math.random() * 8}px`,
                  backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`,
                  animationDelay: `${Math.random() * 0.7}s`, /* Stagger the start */
                  animationDuration: `${2 + Math.random()}s`,
                }}
              />
            ))}
          </div>
          
          {/* Winner Card Container */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="text-center p-8 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl animate-winner-slide">
              <h2 className="text-5xl font-extrabold text-emerald-600 mb-6">
                🎉 The Winner is Chosen! 🎉
              </h2>
              
              {/* The Winner Card - Styled for impact */}
              <div className="w-full max-w-lg mx-auto bg-white border-4 border-emerald-500 rounded-xl shadow-2xl p-6 sm:p-8 transform scale-100">
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">{winningPlace.name}</h3>
                  <p className="text-xl text-gray-700">Rating: <span className="font-semibold">{winningPlace.rating ?? "N/A"}</span></p>
                  <p className="mt-4 text-lg text-gray-500">Redirecting to results...</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. Main Content (Applies blur and opacity transition) */}
      <div className={`flex flex-col flex-grow ${showWinnerAnimation ? 'blur-background opacity-50 pointer-events-none' : ''}`}>
        <header className="p-4 bg-white shadow-md">
          <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              Vote for a Place in <span className="text-blue-600">{code}</span>
            </h1>
            <div className="text-sm text-gray-600">
              Total Voters: <span className="font-semibold text-gray-800">{participants.length}</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
          <p className="mb-4 text-gray-600 text-center">
              Click a **Vote** button to select your choice. Click it again to **cancel** your vote.
          </p>
          <div className="space-y-4">
            {places.map((place) => {
              const pid = String(place.element_id);
              const isOpen = !!expanded[pid];
              const votesForPlace = voteCounts.get(pid) ?? 0;
              const isVotedByMe = userVoteId === pid;
              const hasReviews = place.reviews && place.reviews.length > 0;
              const isUnanimousWinner = votesForPlace === participants.length && participants.length > 0;
              const votePercentage = participants.length > 0 ? (votesForPlace / participants.length) * 100 : 0;
              
              // Hide the winner card from the list when animation starts
              if (showWinnerAnimation && isUnanimousWinner) return null; 

              let buttonText = isVotedByMe ? "Cancel Vote" : "Vote";
              let buttonClass = isVotedByMe ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";
              
              if (isUnanimousWinner) {
                  buttonText = "Winner!";
                  buttonClass = "bg-emerald-600 cursor-default";
              } else if (!isVotedByMe && userVoteId) {
                  buttonClass = "bg-gray-400 hover:bg-gray-500"; 
              }

            const isAiChosenHere = aiChosenIndex === idx;

              return (
                <div key={pid} className={`bg-white border-2 rounded-xl shadow-lg p-4 sm:p-5 transition-all duration-300 
                                        ${isVotedByMe ? 'border-blue-500 shadow-blue-200' : 'border-gray-200'}`}>
                  
                  {/* Voting Progress Bar (Visual Queue) */}
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${isUnanimousWinner ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                          style={{ width: `${votePercentage}%` }}
                      />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header row: name + rating */}
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate flex items-center">
                            {isVotedByMe && !isUnanimousWinner && (
                                <Checkmark className="w-5 h-5 mr-2 text-blue-500 shrink-0" />
                            )}
                            {isUnanimousWinner && (
                                <span className="text-xl mr-2" role="img" aria-label="Trophy">🏆</span>
                            )}
                            {place.name}
                        </h2>
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

                      {/* Reviews section (omitted detail) */}
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

                    {/* Vote button & count */}
                    <div className="shrink-0 flex flex-col items-center">
                      <button
                        type="button"
                        disabled={isUnanimousWinner || showWinnerAnimation} 
                        onClick={() => handleVote(pid)}
                        className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${buttonClass}`}
                        title={isUnanimousWinner ? "Decision reached" : isVotedByMe ? "Click to cancel your vote" : "Vote for this place"}
                      >
                        {buttonText}
                      </button>
                      
                      {/* Visual Vote Count */}
                      <div className="mt-2 text-sm font-semibold text-gray-800 text-center">
                          {votesForPlace} / {participants.length}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

      {/* Floating status */}
      <div className="fixed bottom-4 left-4">
        {aiError && <div className="bg-red-100 text-red-700 px-3 py-2 rounded-md shadow">{aiError}</div>}
      </div>

      {/* Note: the Ask Gemini main button is above in the page */}
    </div>
  );
}
