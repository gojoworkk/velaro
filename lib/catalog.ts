import { asc, eq } from 'drizzle-orm';
import { cars } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { Tier } from './pricing';
import { busyByCar } from './availability';
import { getTiers } from './tiers';
import { todayMoscow } from './validation';

/** Машина в том виде, в каком её ждёт лендинг (как CARS в public/script.js) */
export type CatalogCar = {
  id: string; name: string; cat: 'sport' | 'suv' | 'business'; power: number; accel: string; seats: number;
  price: number; deposit: number; img: string; pos: string; alt: string;
  /** Занятые периоды [с, по] включительно — только даты, без данных клиентов */
  busy: [string, string][];
};

export async function getCatalog(db: AppDb, today: string = todayMoscow(new Date())): Promise<{ cars: CatalogCar[]; tiers: Tier[] }> {
  const busy = await busyByCar(db, today);
  const rows = await db.select().from(cars).where(eq(cars.active, true)).orderBy(asc(cars.sortOrder), asc(cars.id));
  return {
    cars: rows.map((c) => ({
      id: c.id, name: c.name, cat: c.category, power: c.powerHp, accel: c.accel0100, seats: c.seats,
      price: c.pricePerDay, deposit: c.deposit, img: c.photoUrl, pos: c.photoPos, alt: c.photoAlt,
      busy: busy[c.id] ?? [],
    })),
    tiers: await getTiers(db),
  };
}
