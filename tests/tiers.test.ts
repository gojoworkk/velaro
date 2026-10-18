import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { cars, discountTiers } from '@/db/schema';
import { getTiers } from '@/lib/tiers';
import { createTestDb } from './helpers/test-db';

describe('скидки и фото в базе', () => {
  it('миграция заводит 4 ступени скидок', async () => {
    const db = await createTestDb();
    expect(await getTiers(db)).toEqual([
      { minDays: 1, percent: 0 }, { minDays: 3, percent: 10 }, { minDays: 7, percent: 20 }, { minDays: 14, percent: 30 },
    ]);
  });
  it('без ступеней в базе — скидки по умолчанию', async () => {
    const db = await createTestDb();
    await db.delete(discountTiers);
    expect((await getTiers(db))[1]).toEqual({ minDays: 3, percent: 10 });
  });
  it('у машин есть фото, подпись и кадрирование', async () => {
    const db = await createTestDb();
    const [roma] = await db.select().from(cars).where(eq(cars.id, 'ferrari-roma'));
    expect(roma.photoUrl).toMatch(/^https:\/\//);
    expect(roma.photoAlt).toContain('Ferrari Roma');
    expect(roma.photoPos).toBe('50% 58%');
  });
});
