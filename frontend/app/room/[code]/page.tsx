export const dynamic = 'force-dynamic';

"use client";


import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// --- ICON COMPONENTS (Using simple SVG placeholders for demonstration) ---
// Note: Only UserIcon and Crown are used in this waiting room mode.
const UserIcon = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const Crown = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M12 17a1 1 0 0 0 1-1V4"/>
  </svg>
);

// --- TYPES ---
// Reverting to the simpler participant type for this pure waiting room
type Participant = {
    user_id: string;
    is_master: boolean;
    profiles: { username: string } | null;
};

// --- MAIN COMPONENT ---
export default function WaitingRoomPage() {
    const router = useRouter();
    const params = useParams<{ code: string }>();
    const code = (params?.code ?? "").toString().toUpperCase();

    const [userId, setUserId] = useState<string | null>(null);
    const [masterId, setMasterId] = useState<string | null>(null);
    // Reverting to the simpler participant list state
    const [participants, setParticipants] = useState<Participant[]>([]);
    
    const isMaster = useMemo(() => userId && masterId && userId === masterId, [userId, masterId]);
    
    // --- Data Fetching Logic (Reverting select to simpler fields) ---
    const refreshParticipants = async () => {
        const { data, error } = await supabase
            .from("room_participants")
            .select("user_id,is_master,profiles:profiles!room_participants_user_id_fkey(username)")
            .eq("room_code", code)
            .order("is_master", { ascending: false });
        if (!error && data) {
            setParticipants(
                data.map((p: any) => ({
                    user_id: p.user_id,
                    is_master: p.is_master,
                    profiles: p.profiles ?? null,
                }))
            );
        }
    };

    // Load session and initial data
    useEffect(() => {
        (async () => {
            const { data: s } = await supabase.auth.getSession();
            const u = s.session?.user;
            if (!u) {
                router.replace("/");
                return;
            }
            setUserId(u.id);

            // room info
            const { data: room, error: roomErr } = await supabase
                .from("rooms")
                .select("master_id, planning_started")
                .eq("room_code", code)
                .single();
            if (roomErr || !room) {
                // NOTE: Using custom message box/toast instead of alert in production
                alert("Room not found."); 
                router.replace("/home");
                return;
            }
            setMasterId(room.master_id);
            if (room.planning_started) {
                // Initial check: if planning already started, redirect to voting page
                router.replace(`/voting/${code}`);
                return;
            }

            await refreshParticipants();
        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, router]);

    // Realtime: participants and planning_started
    useEffect(() => {
        if (!code) return;
        const channel = supabase
            .channel(`room-${code}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${code}` },
                () => refreshParticipants()
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
                (payload) => {
                    // This is the listener that redirects ALL participants when the master updates the room status
                    const planningStarted = (payload.new as any)?.planning_started;
                    if (planningStarted) router.replace(`/voting/${code}`);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, router]);

    // --- Action Functions ---

    const beginPlanning = async () => {
        const { error } = await supabase
            .from("rooms")
            .update({ planning_started: true })
            .eq("room_code", code)
            .eq("master_id", userId); // only master can trigger
            
        if (error) {
            // NOTE: Using custom message box/toast instead of alert in production
            alert("Failed to start planning.");
        } else {
            // Master redirects immediately after successful DB update
            router.replace(`/voting/${code}`);
        }
    };
    
    // NOTE: submitIntention and related state/logic have been removed.

    // --- Render ---

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            
            {/* Header */}
            <header className="p-4 bg-white shadow-md">
                <h1 className="text-xl font-bold text-gray-800 flex items-center">
                    <UserIcon className="w-6 h-6 mr-2 text-blue-500" />
                    Room Code: <span className="text-blue-600 ml-2">{code}</span>
                </h1>
            </header>

            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
                
                {/* Title and Room Info */}
                <div className="w-full max-w-2xl mx-auto mb-8 text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                        Waiting for Session Start
                    </h2>
                    <p className="text-gray-600 text-lg">
                        You are in room <span className="font-mono bg-gray-200 p-1 rounded text-gray-800">{code}</span>. The session master must begin planning.
                    </p>
                </div>

                {/* Participant List (Simple display) */}
                <section className="pt-4 w-full max-w-sm mx-auto bg-white p-6 rounded-2xl shadow-xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <UserIcon className="w-5 h-5 mr-2 text-gray-600" />
                        Participants ({participants.length})
                    </h3>
                    <ul className="space-y-3">
                        {participants.map((p) => (
                            <li key={p.user_id} className={`flex items-center text-md p-2 rounded-lg ${p.is_master ? 'bg-yellow-50 font-semibold' : 'bg-gray-50'}`}>
                                <span className="mr-3">{p.is_master ? <Crown className="w-4 h-4 text-yellow-500" /> : <UserIcon className="w-4 h-4 text-gray-400" />}</span>
                                <span>{p.profiles?.username ?? `User ${p.user_id.substring(0, 5)}`}</span>
                                {p.is_master && <span className="ml-2 text-xs text-yellow-700">(Master)</span>}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Master Action */}
                {isMaster ? (
                    <div className="mt-8 w-full max-w-sm">
                        <button
                            onClick={beginPlanning}
                            className="w-full flex h-12 items-center justify-center rounded-xl bg-blue-600 text-white px-5 text-lg font-bold transition-colors hover:bg-blue-700 shadow-lg"
                        >
                            Begin Planning
                        </button>
                    </div>
                ) : (
                    <div className="mt-8 w-full max-w-sm text-center p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-blue-700 font-medium">
                            Waiting for the Room Master to start the session...
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
