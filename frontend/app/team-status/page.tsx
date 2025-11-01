"use client";

import React, { useState, useMemo } from 'react';
// Mock lucide-react icons for a single-file environment
const Send = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
  </svg>
);
const User = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);


// --- Mock Data and Initial Setup ---
const INITIAL_USERS = [
  { id: 1, name: 'Ava', icon: '👩‍💻', hasCompleted: true, lastTask: 'Drafting presentation slides' },
  { id: 2, name: 'Ben', icon: '👨‍🚀', hasCompleted: false, lastTask: '' },
  { id: 3, name: 'Chloe', icon: '👩‍🔬', hasCompleted: false, lastTask: '' },
  { id: 4, name: 'Dean', icon: '🧑‍🎓', hasCompleted: false, lastTask: '' },
];

// In a real app, this would come from Firebase Auth/Supabase, but here we pick one.
const CURRENT_USER_ID = 3; // Chloe is the current user in this simulation

// --- Main Component ---
const App = () => {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [taskInput, setTaskInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find the current user object
  const currentUser = useMemo(() => 
    users.find(u => u.id === CURRENT_USER_ID)
  , [users]);

  // Handle the submission of the user's task
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!taskInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    // Simulate API call delay
    setTimeout(() => {
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === CURRENT_USER_ID
            ? { ...user, hasCompleted: true, lastTask: taskInput.trim() }
            : user
        )
      );
      
      setStatusMessage('Your task has been submitted! Others can now see your status.');
      setTaskInput('');
      setIsSubmitting(false);
    }, 1000); 
  };

  // Component for displaying a single user icon
  const UserIconCard = ({ user }) => {
    const isCurrentUser = user.id === CURRENT_USER_ID;
    
    return (
      <div 
        className={`
          flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl 
          shadow-lg transition-all duration-300 transform hover:scale-[1.02] 
          ${isCurrentUser 
            ? 'bg-blue-100 border-2 border-blue-500 ring-4 ring-blue-300' 
            : user.hasCompleted
              ? 'bg-green-100 border-2 border-green-500'
              : 'bg-white border-2 border-gray-200'
          }
        `}
        title={user.lastTask ? `Submitted: ${user.lastTask}` : 'Awaiting input...'}
      >
        {/* Completion Icon */}
        <div className="relative text-3xl sm:text-4xl">
          <span className="relative z-10">{user.icon}</span>
          {user.hasCompleted && (
            // The "hand up" emoji indicator
            <span className="absolute -top-3 -right-3 text-2xl animate-pulse" role="img" aria-label="Completed">
              🙌
            </span>
          )}
        </div>
        
        {/* Name and Role */}
        <p className={`mt-2 text-center text-sm font-semibold ${isCurrentUser ? 'text-blue-700' : 'text-gray-700'}`}>
          {user.name} 
          {isCurrentUser && <span className="text-xs font-normal text-blue-500 block">(You)</span>}
        </p>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-inter">
      
      {/* Header */}
      <header className="p-4 bg-white shadow-md">
        <h1 className="text-xl font-bold text-gray-800 flex items-center">
          <User className="w-6 h-6 mr-2 text-blue-500" />
          Session Status Board
        </h1>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        
        {/* Main Input Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl max-w-2xl w-full mx-auto my-8">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            Hello, {currentUser?.name || 'User'}!
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

          {statusMessage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
              {statusMessage}
            </div>
          )}
           {currentUser?.hasCompleted && !statusMessage && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">
              You have already submitted your intention: **{currentUser.lastTask}**.
            </div>
          )}
        </div>

        {/* User Status Section (at the bottom) */}
        <section className="mt-auto pt-8 border-t border-gray-200 w-full">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Team Status (4 Active Users)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {users.map((user) => (
              <UserIconCard key={user.id} user={user} />
            ))}
          </div>
        </section>

      </main>
    </div>
  );
};

const TeamStatusPage = App;
export default TeamStatusPage;
