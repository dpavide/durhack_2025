"use client";

import { useEffect, useState } from "react";
import { type Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import Hero from "../components/Hero";
import Container from "../components/ui/Container";
import Card from "../components/ui/Card";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <main>
      <Hero />

      {/* Optional: highlight blocks below hero */}
      <section className="pb-14">
        <Container className="grid gap-5 sm:grid-cols-3">
          <Card>
            <h3 className="font-semibold">Smart suggestions</h3>
            <p className="mt-2 text-gray-600">AI ranks options by fairness, travel time, opening hours & weather.</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Real-time collaboration</h3>
            <p className="mt-2 text-gray-600">Create or join a plan, vote or auto-choose, and share instantly.</p>
          </Card>
          <Card>
            <h3 className="font-semibold">Privacy-first</h3>
            <p className="mt-2 text-gray-600">Use approximate locations; control exactly what’s shared.</p>
          </Card>
        </Container>
      </section>
    </main>
  );
}
