import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';

describe('next.config', () => {
  it('отдаёт лендинг на главной', async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toMatchObject({ beforeFiles: [{ source: '/', destination: '/index.html' }] });
  });
});
