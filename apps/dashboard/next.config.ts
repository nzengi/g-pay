import type { NextConfig } from "next";

// Reverse-proxy `/api/*` to the gateway. The destination is read from a
// server-only environment variable so the gateway URL never appears in the
// public source tree or the client bundle.
//
// On Vercel, set `GPAY_GATEWAY_URL` in Project Settings → Environment
// Variables (Production scope). For local development, export it before
// running `npm run dev` (or fall through to direct localhost:3000 fetch by
// not setting it — `apps/dashboard/src/lib/api.ts` handles that case).
const nextConfig: NextConfig = {
  async rewrites() {
    const target = process.env.GPAY_GATEWAY_URL;
    if (!target) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${target.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
