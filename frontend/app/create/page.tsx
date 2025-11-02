// app/create/page.tsx

import { redirect } from "next/navigation";
import { supabase } from "../../lib/supabaseClient"; // You may need to update this import path for server-side use

// Use a separate, server-side-only Supabase client for Server Actions/Components

// Function to generate room code (can stay here or be moved)
function genRoomCode(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

async function createAndRedirect() {
    // This makes the function a Server Action
    "use server"; 
    
    const { data: s } = await supabase.auth.getSession(); // Assuming your existing client can get session
    const user = s.session?.user;

    if (!user) {
        // Use the server-side redirect utility
        redirect("/"); 
    }

    let code = genRoomCode();
    let roomErr: any = { error: true };
    let finalCode = "";
    
    // Attempt to create room (with one retry for collision)
    for (let attempt = 0; attempt < 2; attempt++) {
        const { error } = await supabase.from("rooms").insert({
            room_code: code,
            master_id: user.id,
            planning_started: false,
            polygon_geojson: null,
        });

        if (!error) {
            roomErr = null;
            finalCode = code;
            break; 
        }
        // Prepare for retry
        code = genRoomCode();
    }
    
    if (roomErr) {
        // If both attempts fail, redirect to home with an error state (or to an error page)
        console.error("Failed to create room after two attempts.");
        // Consider passing an error via URL state if needed: redirect("/home?error=room_fail");
        redirect("/home"); 
    }
    
    // Add master as participant
    const { error: partErr } = await supabase.from("room_participants").insert({
        room_code: finalCode,
        user_id: user.id,
        is_master: true,
    });
    
    if (partErr) {
        console.error("Failed to add master as participant:", partErr);
        // Clean up the created room or handle the error
        redirect("/home"); 
    }

    // Server-side redirect to the room page
    redirect(`/room/${finalCode}`);
}

export default async function CreateRoomPage() {
    // We execute the Server Action immediately when the page component loads
    await createAndRedirect();
    
    // This line is technically unreachable because of the redirect() call, 
    // but Next.js requires the component to return valid JSX. 
    // This acts as the "loading" state while the server action runs.
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
                <span className="text-sm text-zinc-500">Creating room…</span>
            </main>
        </div>
    );
}