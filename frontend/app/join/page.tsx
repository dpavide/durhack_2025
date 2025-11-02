"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// Icon for the title
const Lock = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function JoinRoomPage() {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const codeUpper = code.trim().toUpperCase();
        try {
            const { data: s } = await supabase.auth.getSession();
            const user = s.session?.user;
            if (!user) {
                router.replace("/");
                return;
            }

            // Room exists?
            const { data: room, error: roomErr } = await supabase
                .from("rooms")
                .select("room_code")
                .eq("room_code", codeUpper)
                .single();
            if (roomErr || !room) {
                setError("Room not found.");
                setLoading(false);
                return;
            }

            // Current count
            const { count, error: countErr } = await supabase
                .from("room_participants")
                .select("user_id", { count: "exact", head: true })
                .eq("room_code", codeUpper);
            if (countErr) throw countErr;

            if ((count ?? 0) >= 3) {
                setError("MeetSpace full.");
                setLoading(false);
                return;
            }

            // Upsert participant (avoid dup if already in)
            const { error: upsertErr } = await supabase.from("room_participants").upsert(
                {
                    room_code: codeUpper,
                    user_id: user.id,
                    is_master: false,
                },
                { onConflict: "room_code,user_id" }
            );
            if (upsertErr) throw upsertErr;

            router.replace(`/room/${codeUpper}`);
        } catch (err: any) {
            setError(err.message ?? "Failed to join.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 font-sans">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>{`.font-sans { font-family: 'Inter', sans-serif; }`}</style>
            
            <main className="w-full max-w-sm mx-auto p-8 sm:p-10 bg-white rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center mb-6">
                    <Lock className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <h1 className="text-2xl font-bold text-gray-900">Join a Planning Session</h1>
                    <p className="text-gray-500 text-sm">Enter the room code provided by your session master.</p>
                </div>
                
                <form onSubmit={submit} className="space-y-6">
                    <div>
                        <label htmlFor="room-code" className="block text-sm font-medium text-gray-700 mb-1">Room Code</label>
                        <input
                            id="room-code"
                            className={`w-full px-4 py-3 border rounded-xl shadow-inner text-lg uppercase tracking-widest text-center font-mono
                                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out
                                ${loading ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}
                            `}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="ABC123"
                            maxLength={8}
                            disabled={loading}
                        />
                    </div>
                    
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                            {error}
                        </div>
                    )}
                    
                    <button
                        type="submit"
                        disabled={loading || code.trim().length < 6}
                        className={`
                            w-full flex items-center justify-center h-12 px-6 border border-transparent text-base font-medium 
                            rounded-xl shadow-lg text-white transition-colors duration-200 
                            ${(loading || code.trim().length < 6)
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                            }
                        `}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Joining…
                            </>
                        ) : (
                            "Join Room"
                        )}
                    </button>
                </form>
            </main>
        </div>
    );
}
