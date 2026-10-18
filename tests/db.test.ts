import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { cars } from '@/db/schema';
import { seedCars } from '@/db/seed';
import { createTestDb } from './helpers/test-db';

describe('база', () => {
  it('миграции применяются, сид заливает 9 машин', async () => {
    const db = await createTestDb();
    expect(await db.select().from(cars)).toHaveLength(9);
  });
  it('повторный сид не перетирает правки из админки и не дублирует', async () => {
    const db = await createTestDb();
    await db.update(cars).set({ pricePerDay: 1 }).where(eq(cars.id, 'gt3rs'));
    await seedCars(db);
    const [gt3] = await db.select().from(cars).where(eq(cars.id, 'gt3rs'));
    expect(gt3.pricePerDay).toBe(1);
    expect(await db.select().from(cars)).toHaveLength(9);
  });
});
