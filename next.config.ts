import type { NextConfig } from 'next';

// Главная страница — статический лендинг из public/index.html
const nextConfig: NextConfig = {
  // Фото машин до 8 МБ загружаются через серверные функции (по умолчанию лимит 1 МБ)
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
