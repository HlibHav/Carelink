import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export is disabled for Vercel (which supports Next.js natively)
  // To build for Firebase, temporarily set: output: 'export'
  // output: 'export',
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
