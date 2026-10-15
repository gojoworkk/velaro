import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import { seedCars } from '@/db/seed';
import type { AppDb } from '@/db/types';

/** Настоящий Postgres в памяти: те же миграции, что в проде, и 9 машин */
export async function createTestDb(): Promise<AppDb> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seedCars(db as unknown as AppDb);
  return db as unknown as AppDb;
}
