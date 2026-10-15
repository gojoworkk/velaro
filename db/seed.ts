import { sql } from 'drizzle-orm';
import { cars } from './schema';
import { CAR_SEED } from './cars-data';
import type { AppDb } from './types';

/** Добавляет или обновляет 9 машин каталога; повторный запуск безопасен */
export async function seedCars(db: AppDb): Promise<void> {
  const rows = CAR_SEED.map((car, i) => ({ ...car, sortOrder: i }));
  await db
    .insert(cars)
    .values(rows)
    .onConflictDoUpdate({
      target: cars.id,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        powerHp: sql`excluded.power_hp`,
        accel0100: sql`excluded.accel_0_100`,
        seats: sql`excluded.seats`,
        pricePerDay: sql`excluded.price_per_day`,
        deposit: sql`excluded.deposit`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
}
