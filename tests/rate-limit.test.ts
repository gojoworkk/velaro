import { describe, it, expect } from 'vitest';
import { hashIp, checkRateLimit } from '@/lib/rate-limit';
import { rateLimits } from '@/db/schema';
import { createTestDb } from './helpers/test-db';

const at = (min: number) => new Date(Date.UTC(2026, 9, 15, 12, min));

describe('hashIp', () => {
  it('не содержит IP и зависит от соли', () => {
    const h = hashIp('1.2.3.4', 'salt');
    expect(h).not.toContain('1.2.3.4');
    expect(h).toHaveLength(64);
    expect(hashIp('1.2.3.4', 'other')).not.toBe(h);
  });
});

describe('checkRateLimit', () => {
  it('5 заявок пропускает, 6-ю за 10 минут — нет', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) expect(await checkRateLimit(db, 'ip', at(i))).toBe(true);
    expect(await checkRateLimit(db, 'ip', at(5))).toBe(false);
  });
  it('через 10 минут снова можно', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await checkRateLimit(db, 'ip', at(0));
    expect(await checkRateLimit(db, 'ip', at(11))).toBe(true);
  });
  it('другой IP не задевает', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await checkRateLimit(db, 'a', at(0));
    expect(await checkRateLimit(db, 'b', at(1))).toBe(true);
  });
  it('удаляет записи старше суток', async () => {
    const db = await createTestDb();
    await checkRateLimit(db, 'old', new Date(Date.UTC(2026, 9, 13)));
    await checkRateLimit(db, 'new', at(0));
    expect((await db.select().from(rateLimits)).map((r) => r.ipHash)).toEqual(['new']);
  });
});
