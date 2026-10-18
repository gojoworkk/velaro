import { cars } from './schema';
import { CAR_SEED } from './cars-data';
import type { AppDb } from './types';

/** Добавляет машины каталога, если их нет; правки из админки не перетирает. Повторный запуск безопасен */
export async function seedCars(db: AppDb): Promise<void> {
  const rows = CAR_SEED.map((car, i) => ({ ...car, sortOrder: i }));
  await db.insert(cars).values(rows).onConflictDoNothing();
}
