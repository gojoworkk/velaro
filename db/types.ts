import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/** Общий тип базы: подходит и для pg (прод), и для PGlite (тесты) */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
