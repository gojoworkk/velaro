import type { NextConfig } from 'next';

// Главная страница — статический лендинг из public/index.html
const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
