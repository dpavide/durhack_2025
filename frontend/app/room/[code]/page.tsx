"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// Utility function to generate a room code
function genRoomCode(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

export default function CreateRoomPage() {
    const router = useRouter();

    useEffect(() => {
        const createRoom = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData.session?.user;
            
            if (!user) {
                router.replace("/");
                return;
            }

            // Centralized function to handle both room and participant creation
            const createRoomAndJoin = async (c: string, userId: string) => {
                // 1. Create Room
                const { error: roomErr } = await supabase.from("rooms").insert({
                    room_code: c,
                    master_id: userId,
                    planning_started: false,
                    polygon_geojson: null,
                });

                if (roomErr) {
                    // Log collision or other creation error
                    console.error(`Attempt to create room ${c} failed.`, roomErr);
                    return false;
                }

                // 2. Add Master as Participant (This step was likely failing or being skipped)
                const { error: participantErr } = await supabase.from("room_participants").insert({
                    room_code: c,
                    user_id: userId,
                    is_master: true,
                });

                if (participantErr) {
                    // If participant insertion fails, log and clean up the room if necessary
                    console.error(`Failed to add master ${userId} to room ${c}.`, participantErr);
                    // Critical: Delete the room if the master can't join it
                    await supabase.from("rooms").delete().eq("room_code", c);
                    return false;
                }
                
                return true;
            };
            
            let finalRoomCode = "";
            
            // --- Attempt 1 ---
            let code = genRoomCode();
            if (await createRoomAndJoin(code, user.id)) {
                finalRoomCode = code;
            } else {
                // --- Attempt 2 (Retry on collision) ---
                const retryCode = genRoomCode();
                if (await createRoomAndJoin(retryCode, user.id)) {
                    finalRoomCode = retryCode;
                }
            }

            if (finalRoomCode) {
                // Success: Redirect to the new room
                router.replace(`/room/${finalRoomCode}`);
            } else {
                // Failure: Redirect to home page
                console.error("Critical: Failed to create and join room after two attempts.");
                router.replace("/home");
            }
        };

        createRoom();
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>{`.font-sans { font-family: 'Inter', sans-serif; }`}</style>
            <main className="flex w-full max-w-3xl flex-col items-center justify-center p-8">
                <div className="flex items-center justify-center space-x-3 p-6 rounded-xl bg-white shadow-xl">
                    <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg text-zinc-600 font-medium">Securing your MeetSpace...</span>
                </div>
            </main>
        </div>
    );
}
