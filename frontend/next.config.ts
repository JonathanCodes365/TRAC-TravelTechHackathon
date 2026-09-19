import type { NextConfig } from "next";

// Where the FastAPI backend runs. Set API_URL in .env.local to use another
// backend, for example a teammate's laptop on the same Wi-Fi.
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // The browser calls /api/..., and Next.js forwards it to FastAPI,
        // so the backend doesn't need any CORS settings.
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
