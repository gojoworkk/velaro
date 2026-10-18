import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { cars } from '@/db/schema';
import { GET } from '@/app/api/catalog/route';
import { getCatalog } from '@/lib/catalog';
import { setDb } from '@/lib/db';
import { createTestDb } from './helpers/test-db';

describe('каталог', () => {
  afterEach(() => setDb(null));

  it('только видимые машины по порядку, в формате лендинга', async () => {
    const db = await createTestDb();
    await db.update(cars).set({ active: false }).where(eq(cars.id, 'urus'));
    const { cars: list, tiers } = await getCatalog(db);
    expect(list.map((c) => c.id)).toEqual(['gt3rs', 'ferrari-roma', 'huracan', 'g63', 'range-rover', 's63', 'm5', 'bentley']);
    expect(list[0]).toEqual({
      id: 'gt3rs', name: 'Porsche 911 GT3 RS', cat: 'sport', power: 500, accel: '3,3', seats: 2,
      price: 95000, deposit: 300000,
      img: 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?auto=format&fit=crop&w=900&q=80',
      pos: '50% 52%', alt: 'Матово-чёрный Porsche 911 GT3 RS на набережной на закате',
    });
    expect(tiers).toHaveLength(4);
  });
  it('GET /api/catalog — JSON с кэшем на CDN', async () => {
    setDb(await createTestDb());
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=15, stale-while-revalidate=60');
    const data = await res.json();
    expect(data.cars).toHaveLength(9);
    expect(data.tiers[1]).toEqual({ minDays: 3, percent: 10 });
  });
});
