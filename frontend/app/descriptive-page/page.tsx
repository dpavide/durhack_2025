"use client";

import Link from "next/link";

export default function DescriptivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-3xl rounded-lg border border-black/8 dark:border-white/[.145] bg-white dark:bg-zinc-900 p-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-4">
          Plan your next meetup — in minutes.
        </h1>

        <p className="text-zinc-700 dark:text-zinc-300 mb-4">
          MeetSpace helps groups quickly agree on a fair time and place to meet. It balances travel time for everyone,
          shows transparent reasoning behind suggestions, and keeps the whole process simple and collaborative.
        </p>

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6 mb-2">
          What it does
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300">
          <li>Collects everyone’s preferred availability and starting location (roughly or precisely).</li>
          <li>Calculates fair meeting points that minimize total and individual travel time.</li>
          <li>Explains recommendations with distances, durations, and trade‑offs.</li>
          <li>Updates in real time as participants join or change preferences.</li>
        </ul>

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6 mb-2">
          How it works
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-zinc-700 dark:text-zinc-300">
          <li>Create a room and share the code or link with your group.</li>
          <li>Everyone adds their availability and starting point.</li>
          <li>MeetSpace proposes fair options with clear explanations.</li>
          <li>Confirm the choice and share the details instantly.</li>
        </ol>

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-6 mb-2">
          Why it’s fair
        </h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          Instead of picking a spot that benefits just one person, MeetSpace considers the whole group. It aims to
          reduce the maximum travel time and the total time across all participants, while keeping suggestions
          understandable and transparent.
        </p>

        <div className="mt-8 max-w-sm">
          <Link
            href="/home"
            className="mt-3 flex h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-white shadow-lg transition-colors hover:bg-blue-700 text-lg font-semibold"
          >
            Return To Home
          </Link>
        </div>
      </div>
    </div>
  );
}
