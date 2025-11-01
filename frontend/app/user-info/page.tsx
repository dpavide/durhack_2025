"use client";

import { useState } from "react";
import Link from "next/link";

export default function UserInfoPage() {
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const onSubmit =
    (clear: () => void) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      clear();
    };
// needed to note I currently created 7 branches 
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md rounded-lg border border-black/[.08] dark:border-white/[.145] bg-white dark:bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          User info
        </h2>

        <div className="space-y-3">
          <form onSubmit={onSubmit(() => setAge(""))}>
            <input
              type="text"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-transparent"
            />
          </form>

          <form onSubmit={onSubmit(() => setOccupation(""))}>
            <input
              type="text"
              placeholder="Occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-transparent"
            />
          </form>

          <form onSubmit={onSubmit(() => setLatitude(""))}>
            <input
              type="text"
              placeholder="Latitude"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-transparent"
            />
          </form>

          <form onSubmit={onSubmit(() => setLongitude(""))}>
            <input
              type="text"
              placeholder="Longitude"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-md border px-3 py-2 bg-transparent"
            />
          </form>
        </div>

        <Link
          href="/map"
          className="mt-4 block w-full text-center rounded-md border border-black/[.08] px-4 py-2 text-sm transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Select Area on Map
        </Link>

        <Link href="/" className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
          Back to home
        </Link>
      </div>
    </div>
  );
}
