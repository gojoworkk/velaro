import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import type { AppDb } from '@/db/types';

let db: AppDb | null = null;

/** Одно подключение на экземпляр функции; создаётся при первом запросе */
export function getDb(): AppDb {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL не задан');
    db = drizzle(new Pool({ connectionString: url, max: 3 }), { schema }) as unknown as AppDb;
  }
  return db;
}

/** Только для тестов: подменить базу */
export function setDb(next: AppDb | null): void {
  db = next;
}
