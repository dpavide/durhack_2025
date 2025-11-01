import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="card text-center">
        <h1 className="text-2xl font-semibold mb-4">Welcome</h1>
        <p className="text-gray-600 mb-6">Open the interactive map to select an area.</p>
        <Link href="/map" className="button-primary inline-block w-auto px-6">
          Open Map
        </Link>
      </div>
    </main>
  );
}
