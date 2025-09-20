import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
    eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // 👈 TS 에러 무시
  },
};

export default nextConfig;
