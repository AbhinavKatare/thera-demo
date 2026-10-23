import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@paypilot/core', '@paypilot/connectors', '@paypilot/ai'],
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: 'http://localhost:4000/docs',
      },
      {
        source: '/docs/:path*',
        destination: 'http://localhost:4000/docs/:path*',
      },
      {
        source: '/v1/:path*',
        destination: 'http://localhost:4000/v1/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:4000/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
