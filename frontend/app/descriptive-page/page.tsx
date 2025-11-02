import Link from "next/link";

export const metadata = {
  title: "How It Works | MeetUp Planner",
  description:
    "A quick walkthrough of how to use our AI-powered meetup planner to pick a fair, fun place and time.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      title: "1) Start a plan (or join one)",
      body:
        "Open a new room and share the invite link with friends or colleagues. Or join a plan someone shared with you.",
    },
    {
      title: "2) Add people & locations",
      body:
        "Each person adds a rough location (postcode/city or map pin). No exact addresses required — privacy first.",
    },
    {
      title: "3) Tell us what you want",
      body:
        "Pick Formal or Informal, set a time window, budget, accessibility needs, and any preferences (e.g., cuisine, indoor/outdoor).",
    },
    {
      title: "4) Let the AI suggest options",
      body:
        "We find fair meet-in-the-middle options, score them by travel time balance, opening hours, live weather, and your preferences.",
    },
    {
      title: "5) Vote or auto-choose",
      body:
        "Send a quick poll to the group or accept the top recommendation. Every option shows a short 'Why this?' explanation.",
    },
    {
      title: "6) Share & go",
      body:
        "Get a shareable link with the venue, exact meet point, and personalized routes/ETAs for each person.",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Plan your next meetup — in minutes.
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Our app helps groups decide <span className="font-medium">where</span>,
          <span className="font-medium"> when</span>, and <span className="font-medium">what to do</span>,
          balancing travel time fairly and explaining every recommendation.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/map"
            className="rounded-full bg-indigo-600 text-white px-5 py-3 text-sm font-medium hover:bg-indigo-700 transition"
          >
            Try the Map
          </Link>
          <Link
            href="/user-info"
            className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium hover:bg-zinc-100 transition"
          >
            Add Your Details
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <div className="grid sm:grid-cols-2 gap-5">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-5"
            >
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-zinc-600">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Little extras */}
        <div className="mt-8 grid sm:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-5">
            <h4 className="font-semibold">Fairness meter</h4>
            <p className="mt-2 text-zinc-600">
              We minimize the longest travel time so nobody gets the short end of the stick.
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-5">
            <h4 className="font-semibold">Explainable AI</h4>
            <p className="mt-2 text-zinc-600">
              Every suggestion includes a short reason (preferences, opening hours, weather, etc.).
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm border border-zinc-200 p-5">
            <h4 className="font-semibold">Privacy first</h4>
            <p className="mt-2 text-zinc-600">
              We use approximate locations and don’t store exact addresses. You control what’s shared.
            </p>
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Ready to plan?</h3>
            <p className="text-zinc-600">
              Jump to the map to drop pins or import suggestions from our AI.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/map"
              className="rounded-full bg-emerald-600 text-white px-5 py-3 text-sm font-medium hover:bg-emerald-700 transition"
            >
              Open the Map
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium hover:bg-zinc-100 transition"
            >
              Read again
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
