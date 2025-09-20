import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // 👈 TS 에러 무시
  },
  // WASM 지원 및 외부 패키지 설정
  serverExternalPackages: ['@mysten/walrus'],
  webpack: (config, { isServer }) => {
    // WASM 파일 처리
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // WASM 파일을 정적 자산으로 처리
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // 클라이언트 사이드에서만 특정 패키지 로드
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
