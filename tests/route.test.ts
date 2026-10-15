import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/requests/route';
import { setDb } from '@/lib/db';
import { createTestDb } from './helpers/test-db';

const post = (body: unknown, ip = '9.9.9.9') =>
  POST(new Request('http://localhost/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));

const valid = {
  name: 'Анна', phone: '89991234567', carId: 'g63',
  dateFrom: '2099-01-10', dateTo: '2099-01-12', delivery: 'pickup', address: '', comment: '', website: '',
};

describe('POST /api/requests', () => {
  beforeEach(async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    setDb(await createTestDb());
  });
  afterEach(() => { setDb(null); vi.unstubAllEnvs(); });

  it('201 и номер заявки', async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 1 });
  });
  it('400 с ошибками по полям', async () => {
    const res = await post({ ...valid, name: '' });
    expect(res.status).toBe(400);
    expect((await res.json()).errors.name).toBeTruthy();
  });
  it('битый JSON — 400', async () => {
    expect((await post('{не json')).status).toBe(400);
  });
  it('429 после лимита', async () => {
    for (let i = 0; i < 5; i++) await post(valid);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });
  it('база упала — 500', async () => {
    setDb({ select: () => { throw new Error('db down'); }, delete: () => { throw new Error('db down'); } } as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(valid);
    expect(res.status).toBe(500);
  });
});
