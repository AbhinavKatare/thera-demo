import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@paypilot/core', '@paypilot/connectors', '@paypilot/ai'],
};

export default nextConfig;
