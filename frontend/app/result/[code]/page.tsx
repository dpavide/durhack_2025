"use client";

import React from "react";
import { useParams } from "next/navigation";

export default function ResultPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <script src="https://cdn.tailwindcss.com"></script>
      {/* ...empty for now... */}
      <div className="text-gray-400 text-sm">Result page for {code}</div>
    </div>
  );
}
