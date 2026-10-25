import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone com só o necessário para rodar em container
  output: 'standalone',
};

export default nextConfig;
