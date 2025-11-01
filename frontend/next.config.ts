import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev rewrite: proxy frontend /api requests to the FastAPI dev server
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: "http://localhost:8000/api/:path*",
          },
        ]
      : [];
  },
};

export default nextConfig;
