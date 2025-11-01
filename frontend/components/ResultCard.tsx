'use client';
import { motion } from 'framer-motion';

interface ResultCardProps {
  result: {
    venue: string;
    address: string;
    activity: string;
    reasoning: string;
    duration: string;
  };
}

export default function ResultCard({ result }: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-6 mt-8"
    >
      <h3 className="text-xl font-bold text-indigo-600 mb-2">{result.venue}</h3>
      <p className="text-gray-600 mb-1">{result.address}</p>
      <p className="text-gray-500 italic mb-3">{result.activity}</p>
      <p className="text-gray-700">{result.reasoning}</p>
      <p className="text-gray-500 mt-3">⏱ Estimated duration: {result.duration}</p>
    </motion.div>
  );
}
