'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center text-center min-h-[80vh] px-4 bg-gradient-to-b from-indigo-50 to-white">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl font-bold text-indigo-700 mb-4"
      >
        Plan your next meetup — intelligently
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-2xl text-gray-600 mb-8"
      >
        An AI-powered meeting planner that chooses the best time, place, and activity for you and your friends or colleagues.
      </motion.p>

      <Link href="/plan">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-8 py-3 text-lg font-medium bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition"
        >
          Start Planning
        </motion.button>
      </Link>
    </section>
  );
}
