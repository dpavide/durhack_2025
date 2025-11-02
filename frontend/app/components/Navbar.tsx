"use client";

import Link from "next/link";
import Container from "./ui/Container";

export default function Navbar() {
  return (
    <header className="py-4">
      <Container className="flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 soft-shadow">
            {/* icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 118 0 4 4 0 01-8 0Z" />
            </svg>
          </span>
          <span className="text-2xl font-extrabold tracking-tight" style={{color:"var(--brand-ink)"}}>MeetSpace</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/how-it-works" className="btn btn-outline h-10 px-4">How it works</Link>
          <Link href="/" className="btn btn-outline h-10 px-4">Sign Up / Login</Link>
        </nav>
      </Container>
    </header>
  );
}
