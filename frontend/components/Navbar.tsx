'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-6 py-4 bg-white shadow-md sticky top-0 z-50"
    >
      <div className="text-2xl font-bold text-indigo-600">🤖 AI Meeting Planner</div>
      <div className="space-x-6">
        <Link href="/" className="text-gray-600 hover:text-indigo-600 transition">
          Home
        </Link>
        <Link href="/plan" className="text-gray-600 hover:text-indigo-600 transition">
          Plan
        </Link>
      </div>
    </motion.nav>
  );
}
