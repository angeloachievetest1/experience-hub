import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      // The Follow-up page was renamed to Resolution (owner decision 2026-09-30).
      { source: '/quality-analyst/follow-up', destination: '/quality-analyst/resolution', permanent: true },
    ];
  },
};

export default nextConfig;
