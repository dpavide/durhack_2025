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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // place_id -> expanded?

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

  // --- CRITICAL FIX: Winning place must have votes equal to ALL participants ---
  const winningPlaceId = useMemo(() => {
    const total = participants.length;
    if (total === 0 || places.length === 0) return null; 
    
    // Check if any place has ALL votes
    for (const pid of placeIdList) {
      if ((voteCounts.get(pid) ?? 0) === total) return pid; // Must be strictly equal to total
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

  // Function to fetch and process listings (Unchanged)
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
        
        try {
          const res = await fetch(url);
          if (res.ok) {
            const gmapData = await res.json();
            return { ...place, ...gmapData };
          }
          console.warn(`GMap search failed for ${place.name} (status: ${res.status})`);
          return { ...place, element_id: place.id, reviews: [], rating: null };
        } catch (e) {
          console.error(`Failed to fetch GMap data for ${place.name}:`, e);
          return { ...place, element_id: place.id, reviews: [], rating: null };
        }
      });

      const gmapResults = await Promise.all(gmapApiFetches);

      // 4. Format and set state
      const formattedPlaces: Place[] = gmapResults.map((p: any) => ({
        element_id: String(p.element_id ?? p.id), 
        name: p.name ?? "Unknown Location",
        rating: p.rating ?? null,
        reviews: p.reviews || [],
        lat: p.lat,
        lon: p.lon,
      }));
  
      setPlaces(formattedPlaces);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching listings:", err);
      setError(err.message || "Failed to load listings.");
    } finally {
        setLoading(false);
    }
  }, []);

  // Main useEffect to run all fetches
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
        fetchListings(code) 
      ]);
      // set loading false inside fetchListings
    })();
  }, [code, router, refreshParticipants, refreshVotes, fetchListings]);

  // Realtime sync for participants and votes (Unchanged)
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

  // Redirect when any place reaches unanimous votes (Unchanged)
  useEffect(() => {
    if (winningPlaceId) {
      router.replace(`/result/${code}`);
    }
  }, [winningPlaceId, router, code]);

  // --- CRITICAL FIX: Vote/Unvote Handler ---
  const handleVote = async (place_id: string) => {
    if (!userId || !code) return;
    
    // Check if the user is voting for the place they already voted for (cancel vote)
    const isUnvoting = userVoteId === place_id;

    if (isUnvoting) {
      // 1. DELETE the vote from the database
      const { error } = await supabase
        .from("place_votes")
        .delete()
        .eq("room_code", code)
        .eq("user_id", userId);

      if (error) {
        console.error("Unvote error:", error);
        return;
      }

      // 2. Optimistic update: remove the vote from state
      setVotes((prev) => prev.filter((v) => v.user_id !== userId));

    } else {
      // 1. UPSERT (create or update) the new vote
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
      
      // 2. Optimistic update: replace or add the vote in state
      setVotes((prev) => {
        // Remove existing vote by this user
        const filtered = prev.filter((v) => v.user_id !== userId);
        // Add the new vote
        return [...filtered, { user_id: userId, place_id }];
      });
    }
  };

  // -----------------------
  // ASK GEMINI IMPLEMENTATION
  // -----------------------
  const BACKEND_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "");

  // Build the system prompt exactly as requested. It begins with the JSON array of places.
  // We include only element_id, name, rating, reviews (reviews: rating, text, author_name).
  const buildSystemPromptForPlaces = (placesToSend: Place[]) => {
    const jsonFromListings = placesToSend.map((p) => ({
      element_id: p.element_id,
      name: p.name,
      rating: p.rating ?? null,
      reviews: (p.reviews ?? []).map((r) => ({
        rating: r.rating ?? null,
        text: r.text ?? "",
        author_name: r.author_name ?? "",
      })),
    }));
    // The user asked for an f-string like: f"{json_from_listings}\n**Role:** ..."
    const roleAndInstructions = `
**Role:** You are a decisive dining and activity advisor. Your task is to analyze a list of places and recommend exactly ONE option.

**Input:** You will receive a JSON array of places in f-string format. Each place has:
- \`element_id\`: unique identifier
- \`name\`: place name
- \`rating\`: numerical rating (higher is better)
- \`reviews\`: array of review objects with \`rating\`, \`text\`, and \`author_name\`

**Decision Process:**
1. **Primary Focus:** Analyze ratings and review content as the most important factors
2. **Rating Priority:** Favor places with higher overall ratings (4.0+ is good, 4.5+ is excellent)
3. **Review Analysis:** Look for consistent positive themes in review texts (food quality, service, ambiance, value)
4. **Review Volume:** Consider places with more substantive, detailed reviews as more reliable
5. **Tie-breaking:** If ratings are similar, choose based on more enthusiastic or consistent positive reviews

**Output Format:** Respond ONLY with this exact JSON structure:
\`\`\`json
{"index_chosen": number, "response": "string"}
\`\`\`
`;
    return `${JSON.stringify(jsonFromListings)}\n${roleAndInstructions}`;
  };

  const tryExtractJson = (raw: string): string | null => {
    // Attempt straightforward parse first
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      // try to find first { ... } JSON object (or array)
      const firstBrace = raw.indexOf("{");
      const firstBracket = raw.indexOf("[");
      let start = -1;
      if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
        // array
        start = firstBracket;
        const lastBracket = raw.lastIndexOf("]");
        if (lastBracket !== -1) {
          const candidate = raw.slice(start, lastBracket + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {}
        }
      } else if (firstBrace !== -1) {
        start = firstBrace;
        const lastBrace = raw.lastIndexOf("}");
        if (lastBrace !== -1) {
          const candidate = raw.slice(start, lastBrace + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {}
        }
      }
      return null;
    }
  };

  const downloadPythonFile = (obj: any, filename = "gemini_result.py") => {
    // Convert JS object -> JSON string -> tweak to be valid python literals for null/true/false
    let json = JSON.stringify(obj, null, 2);
    // Replace null/true/false with Python equivalents
    json = json.replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
    const pythonContents = `# Auto-generated by Ask Gemini\nresult = ${json}\n`;
    const blob = new Blob([pythonContents], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setAiSavedFilename(filename);
  };

  const handleAskGemini = async () => {
    if (places.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiChosenIndex(null);
    setAiResponseText(null);
    setAiSavedFilename(null);

    try {
      // 1) Build system prompt including JSON of places
      const systemPrompt = buildSystemPromptForPlaces(places);

      // 2) POST to backend /api/gemini/set_prompt with prompt="" (we put JSON in system_prompt per your instruction)
      const setPromptUrl = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/gemini/set_prompt` : "/api/gemini/set_prompt";

      const setResp = await fetch(setPromptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "", system_prompt: systemPrompt }),
      });

      if (!setResp.ok) {
        const txt = await setResp.text().catch(() => "");
        throw new Error(`Failed to call Gemini set_prompt: ${setResp.status} ${txt}`);
      }

      // set_prompt attempts to call Gemini synchronously and stores GEMINI_RESPONSE.
      // fetch the response from /get_response. If not present yet, try /generate then /get_response once.
      const getResponseUrl = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/gemini/get_response` : "/api/gemini/get_response";
      let getResp = await fetch(getResponseUrl);
      let resultJson = await getResp.json().catch(() => ({ response: null }));
      if (!resultJson || !resultJson.response) {
        // Try to trigger generation explicitly (use POST /generate) and then fetch again
        const genUrl = BACKEND_BASE !== "" ? `${BACKEND_BASE}/api/gemini/generate` : "/api/gemini/generate";
        // call generate with no body; router will use stored prompt+system_prompt
        await fetch(genUrl, { method: "POST" });
        // wait a short moment for backend to populate GEMINI_RESPONSE (best-effort)
        await new Promise((r) => setTimeout(r, 500));
        getResp = await fetch(getResponseUrl);
        resultJson = await getResp.json().catch(() => ({ response: null }));
      }

      const rawResponse: string = (resultJson && resultJson.response) ? String(resultJson.response).trim() : "";
      if (!rawResponse) throw new Error("Empty response from Gemini.");

      // Try parsing JSON result
      // The model should return: {"index_chosen": number, "response": "string"}
      let parsed: any = null;

      // First try direct parse
      try {
        parsed = JSON.parse(rawResponse);
      } catch {
        // try to extract the JSON substring
        const extracted = tryExtractJson(rawResponse);
        if (!extracted) {
          throw new Error("Gemini response did not contain valid JSON.");
        }
        parsed = JSON.parse(extracted);
      }

      // Validate parsed content
      if (!parsed || typeof parsed !== "object" || typeof parsed.index_chosen !== "number" || typeof parsed.response !== "string") {
        throw new Error("Parsed Gemini response was not in the expected shape {index_chosen: number, response: string}");
      }

      // Store AI results in state
      const chosenIndex = parsed.index_chosen;
      setAiChosenIndex(chosenIndex);
      setAiResponseText(parsed.response);

      // Create a python file (client-side download) which defines `result` dictionary
      // You requested a file that "turns it into an actual working dictionary in Python"
      downloadPythonFile(parsed, `gemini_result_${Date.now()}.py`);

      setAiLoading(false);
    } catch (err: any) {
      console.error("Ask Gemini error:", err);
      setAiError(err?.message || String(err));
      setAiLoading(false);
    }
  };

  // --- RENDER LOGIC (Loading, Error, Empty states remain the same) ---
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

  if (error || places.length === 0) {
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* AI badge / speech bubble styling */
        .ai-badge {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:14px;
          color:white;
          background:#6b21a8; /* purple */
          box-shadow:0 2px 6px rgba(0,0,0,0.12);
        }
        .ai-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .ai-bubble {
          position: absolute;
          right: 36px;
          top: -6px;
          min-width: 180px;
          max-width: 320px;
          background: white;
          border: 1px solid rgba(0,0,0,0.06);
          padding: 8px 10px;
          border-radius: 8px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.12);
          font-size: 13px;
          color:#111827;
          display: none;
          z-index: 40;
        }
        .ai-container:hover .ai-bubble {
          display: block;
        }
        .ai-bubble::after {
          content: "";
          position: absolute;
          right: -6px;
          top: 12px;
          width: 0;
          height: 0;
          border-left: 6px solid rgba(0,0,0,0.06);
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
        }
      `}</style>

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

        {/* AI status + Ask button */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleAskGemini}
            disabled={aiLoading}
            className={`px-4 py-2 rounded-full text-white font-semibold shadow ${aiLoading ? "bg-purple-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"}`}
            title="Ask Gemini to pick the best place from the list"
          >
            {aiLoading ? "Thinking..." : "Ask Gemini"}
          </button>

          {aiLoading && <div className="text-sm text-gray-600">AI analyzing places…</div>}
          {aiError && <div className="text-sm text-red-600">{aiError}</div>}
          {aiResponseText && <div className="text-sm text-gray-700">AI suggestion ready — saved as <span className="font-medium">{aiSavedFilename ?? "gemini_result.py"}</span></div>}
        </div>

        <div className="space-y-4">
          {places.map((place, idx) => {
            const pid = String(place.element_id);
            const isOpen = !!expanded[pid];
            const votesForPlace = voteCounts.get(pid) ?? 0;
            const isVotedByMe = userVoteId === pid;
            const hasReviews = place.reviews && place.reviews.length > 0;
            const isUnanimousWinner = votesForPlace === participants.length && participants.length > 0;
            const votePercentage = participants.length > 0 ? (votesForPlace / participants.length) * 100 : 0;

            let buttonText = isVotedByMe ? "Cancel Vote" : "Vote";
            let buttonClass = isVotedByMe ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700";
            
            if (isUnanimousWinner) {
                buttonText = "Winner!";
                buttonClass = "bg-emerald-600 cursor-default";
            } else if (!isVotedByMe && userVoteId) {
                // If I have voted for *another* option, disable this button visually
                buttonClass = "bg-gray-400 cursor-pointer"; // Re-enable click for unvote functionality
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
                        {(place.reviews ?? []).slice(0, 2).map((r, ridx) => (
                          <div key={ridx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
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

                  {/* Right column: AI badge (if chosen) + Vote button & count */}
                  <div className="shrink-0 flex flex-col items-center gap-3">
                    {/* AI badge: shown if this index was selected by AI */}
                    {isAiChosenHere && (
                      <div className="ai-container mb-1">
                        <div className="ai-badge" aria-hidden>💬</div>
                        <div className="ai-bubble">
                          <div className="font-semibold text-sm mb-1">Gemini recommends:</div>
                          <div className="text-sm whitespace-pre-wrap">{aiResponseText}</div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      // Disable if winner is decided, otherwise allow vote/unvote
                      disabled={isUnanimousWinner} 
                      onClick={() => handleVote(pid)}
                      className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${buttonClass}`}
                      title={isUnanimousWinner ? "Decision reached" : isVotedByMe ? "Click to cancel your vote" : "Vote for this place"}
                    >
                      {isUnanimousWinner ? "Winner!" : (isVotedByMe ? "Cancel Vote" : "Vote")}
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
