"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from "../../../lib/supabaseClient";

// --- ICON COMPONENTS (Using simple SVG placeholders) ---
const Send = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
  </svg>
);
const User = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

// --- EMOJI PROFILES (8 distinct icons) ---
const EMOJI_PROFILES = [
  '👩‍💻', '👨‍🚀', '👩‍🔬', '🧑‍🎓', '🤖', '👽', '🦁', '🦊'
];

// --- TYPES ---
type Participant = {
    user_id: string;
    username: string;
    // We can merge intention data here for easier rendering
    task_description: string | null;
};

type Intention = {
    user_id: string;
    task_description: string;
}


// --- MAIN COMPONENT ---
export default function VotingPage() {
    const router = useRouter();
    const params = useParams<{ code: string }>();
    const code = (params?.code ?? "").toString().toUpperCase();

    const [userId, setUserId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [taskInput, setTaskInput] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Combines participants list with submitted intentions
    const usersWithStatus = useMemo(() => {
        // Map intentions for fast lookup
        const intentionMap = new Map(intentions.map(i => [i.user_id, i.task_description]));
        
        return participants.map((p) => ({
            ...p,
            task_description: intentionMap.get(p.user_id) || null,
            emoji: EMOJI_PROFILES[participants.findIndex(up => up.user_id === p.user_id) % EMOJI_PROFILES.length],
            isCurrentUser: p.user_id === userId,
            hasCompleted: !!intentionMap.get(p.user_id),
        }));
    }, [participants, intentions, userId]);

    const currentUser = useMemo(() => 
        usersWithStatus.find(u => u.isCurrentUser)
    , [usersWithStatus]);
    
    // NEW: Check if all active participants have submitted their intention
    const allUsersVoted = useMemo(() => {
        if (participants.length === 0) return false;
        // The session is complete if the number of intentions matches the number of participants
        return intentions.length === participants.length;
    }, [participants.length, intentions.length]);


    // --- DATA FETCHING ---
    const refreshData = useCallback(async () => {
        if (!code) return;

        // 1. Fetch Room Participants
        const { data: participantsData, error: pError } = await supabase
            .from("room_participants")
            .select("user_id, profiles:profiles!room_participants_user_id_fkey(username)")
            .eq("room_code", code)
            .order("user_id", { ascending: true });

        if (pError) {
            console.error("Error fetching participants:", pError);
            return;
        }

        const formattedParticipants: Participant[] = participantsData.map((p: any) => ({
            user_id: p.user_id,
            username: p.profiles?.username ?? `User ${p.user_id.substring(0, 5)}`,
            task_description: null, // Initial empty task
        }));
        
        setParticipants(formattedParticipants);

        // 2. Fetch Planning Intentions (assuming a table for this purpose)
        const { data: intentionsData, error: iError } = await supabase
            .from("planning_intentions") // NOTE: Assuming this table name
            .select("user_id, task_description")
            .eq("room_code", code);

        if (iError) {
            console.error("Error fetching intentions:", iError);
            // Non-fatal, proceed with empty intentions
            setIntentions([]); 
        } else {
            setIntentions(intentionsData as Intention[]);
        }
    }, [code]);

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
            await refreshData();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, router]);

    // --- REALTIME LISTENERS ---
    useEffect(() => {
        if (!code) return;

        // Realtime Listener for participants joining/leaving
        const participantChannel = supabase
            .channel(`participants-${code}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "room_participants", filter: `room_code=eq.${code}` },
                () => refreshData()
            )
            .subscribe();

        // Realtime Listener for intentions (tasks) being submitted
        const intentionChannel = supabase
            .channel(`intentions-${code}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "planning_intentions", filter: `room_code=eq.${code}` },
                () => refreshData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(participantChannel);
            supabase.removeChannel(intentionChannel);
        };
    }, [code, refreshData]);

    // --- REDIRECTION LOGIC: Redirect when everyone has voted ---
    useEffect(() => {
        if (allUsersVoted && code) {
            console.log("All participants have voted. Redirecting to map.");
            // Redirects all users to the next stage of the application
            router.replace(`/map/${code}`);
        }
    }, [allUsersVoted, code, router]);


    // --- ACTION FUNCTIONS ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskInput.trim() || isSubmitting || !userId) return;

        setIsSubmitting(true);
        setStatusMessage('');
        
        // Insert or Update the player's intention for this room
        const { error } = await supabase
            .from("planning_intentions")
            .upsert({ 
                user_id: userId, 
                room_code: code, 
                task_description: taskInput.trim() 
            }, { 
                onConflict: 'user_id, room_code' // Unique constraint on user_id and room_code
            });
            
        if (error) {
            console.error("Submission error:", error);
            setStatusMessage('Failed to submit intention. Please try again.');
        } else {
            // Manually update local state for instant "hand-raising" feedback
            setIntentions(prevIntentions => {
                const newIntention: Intention = {
                    user_id: userId,
                    task_description: taskInput.trim()
                };
                
                // Remove the old intention for the current user and add the new one
                return [...prevIntentions.filter(i => i.user_id !== userId), newIntention];
            });
            
            setStatusMessage('Your task has been submitted! Waiting for others.');
            setTaskInput('');
        }
        
        setIsSubmitting(false);
    };

    // --- RENDER CARD COMPONENT ---
    const UserIconCard = ({ user }: { user: typeof usersWithStatus[0] }) => {
        const { isCurrentUser, hasCompleted, task_description, username, emoji } = user;
        
        return (
            <div 
                className={`
                    flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl 
                    shadow-lg transition-all duration-300 transform hover:scale-[1.02] 
                    ${isCurrentUser 
                        ? 'bg-blue-100 border-2 border-blue-500 ring-4 ring-blue-300' 
                        : hasCompleted
                            ? 'bg-green-100 border-2 border-green-500'
                            : 'bg-white border-2 border-gray-200'
                    }
                `}
                title={task_description ? `Submitted: ${task_description}` : 'Awaiting input...'}
            >
                {/* Completion Icon */}
                <div className="relative text-3xl sm:text-4xl">
                    <span className="relative z-10">{emoji}</span>
                    {hasCompleted && (
                        // The "hand up" emoji indicator
                        <span className="absolute -top-3 -right-3 text-2xl animate-pulse" role="img" aria-label="Completed">
                            🙌
                        </span>
                    )}
                </div>
                
                {/* Name and Role */}
                <p className={`mt-2 text-center text-sm font-semibold ${isCurrentUser ? 'text-blue-700' : 'text-gray-700'}`}>
                    {username} 
                    {isCurrentUser && <span className="text-xs font-normal text-blue-500 block">(You)</span>}
                </p>
            </div>
        );
    };

    if (!userId || participants.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-6 bg-white rounded-xl shadow-xl">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-700 font-medium">Loading session data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>{`
                .font-sans { font-family: 'Inter', sans-serif; }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
            
            {/* Header */}
            <header className="p-4 bg-white shadow-md">
                <h1 className="text-xl font-bold text-gray-800 flex items-center">
                    <User className="w-6 h-6 mr-2 text-blue-500" />
                    Session: <span className="text-blue-600 ml-2">{code}</span> Planning
                </h1>
            </header>

            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
                
                {/* Main Input Card */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-2xl w-full mx-auto my-8">
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
                        Hello, {currentUser?.username || 'User'}!
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Let your team know what you plan to focus on during this session.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label htmlFor="task-input" className="block text-lg font-medium text-gray-700">
                            What do you want to do?
                        </label>
                        <div className="relative">
                            <input
                                id="task-input"
                                type="text"
                                value={taskInput}
                                onChange={(e) => {
                                    setTaskInput(e.target.value);
                                    setStatusMessage('');
                                }}
                                placeholder="e.g., Finalize the marketing budget or Review last week's tickets"
                                disabled={currentUser?.hasCompleted || isSubmitting}
                                className={`
                                    w-full px-4 py-3 border rounded-xl shadow-inner text-gray-800
                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                                    transition duration-150 ease-in-out
                                    ${currentUser?.hasCompleted ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'}
                                `}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!taskInput.trim() || currentUser?.hasCompleted || isSubmitting}
                            className={`
                                w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium 
                                rounded-xl shadow-sm text-white transition-colors duration-200 
                                ${(!taskInput.trim() || currentUser?.hasCompleted || isSubmitting) 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                }
                            `}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Submitting...
                                </>
                            ) : currentUser?.hasCompleted ? (
                                'Submitted (Your turn is complete)'
                            ) : (
                                <>
                                    Submit Intention <Send className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {(statusMessage || currentUser?.hasCompleted) && (
                        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${statusMessage ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                            {statusMessage ? (
                                statusMessage
                            ) : (
                                <>
                                    You have already submitted your intention: **{currentUser?.task_description}**.
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* User Status Section (at the bottom) */}
                <section className="mt-auto pt-8 border-t border-gray-200 w-full">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                        Team Status ({usersWithStatus.length} Active Users)
                    </h3>
                    {usersWithStatus.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {usersWithStatus.map((user) => (
                                <UserIconCard key={user.user_id} user={user} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No participants currently in the room.</p>
                    )}
                    
                    {/* Display message if all users have voted, before redirect */}
                    {allUsersVoted && (
                         <div className="mt-8 p-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg text-center font-bold">
                            All intentions recorded! Redirecting to map stage...
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
}
