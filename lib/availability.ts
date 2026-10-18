import { and, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { carBlocks, requests } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { dateRange } from './format';

export type Period = { from: string; to: string };
export type Conflict =
  | { kind: 'request'; id: number; from: string; to: string }
  | { kind: 'block'; id: number; reason: string; from: string; to: string };

/** Статусы заявок, которые занимают машину */
export const BUSY_STATUSES = ['confirmed', 'completed'] as const;

/** Периоды включительные: день возврата тоже занят */
export const overlaps = (a: Period, b: Period) => a.from <= b.to && b.from <= a.to;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Сортирует и сливает пересекающиеся и соседние периоды */
export function mergePeriods(list: Period[]): [string, string][] {
  const sorted = [...list].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const out: [string, string][] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (last && p.from <= addDays(last[1], 1)) {
      if (p.to > last[1]) last[1] = p.to;
    } else {
      out.push([p.from, p.to]);
    }
  }
  return out;
}

export async function findConflicts(
  db: AppDb,
  carId: string,
  period: Period,
  opts: { excludeRequestId?: number } = {},
): Promise<Conflict[]> {
  const reqConds: SQL[] = [
    eq(requests.carId, carId),
    inArray(requests.status, [...BUSY_STATUSES]),
    lte(requests.dateFrom, period.to),
    gte(requests.dateTo, period.from),
  ];
  if (opts.excludeRequestId) reqConds.push(ne(requests.id, opts.excludeRequestId));
  const reqs = await db
    .select({ id: requests.id, from: requests.dateFrom, to: requests.dateTo })
    .from(requests)
    .where(and(...reqConds));
  const blocks = await db
    .select({ id: carBlocks.id, reason: carBlocks.reason, from: carBlocks.dateFrom, to: carBlocks.dateTo })
    .from(carBlocks)
    .where(and(eq(carBlocks.carId, carId), lte(carBlocks.dateFrom, period.to), gte(carBlocks.dateTo, period.from)));
  return [
    ...reqs.map((r) => ({ kind: 'request' as const, ...r })),
    ...blocks.map((b) => ({ kind: 'block' as const, ...b })),
  ].sort((a, b) => (a.from < b.from ? -1 : 1));
}

export function describeConflict(c: Conflict): string {
  const when = dateRange(c.from, c.to);
  return c.kind === 'request' ? `заявка №${c.id}, ${when}` : `${c.reason}, ${when}`;
}

/** Занятые периоды машин для сайта: только даты, только будущее, примерно на 13 месяцев вперёд */
export async function busyByCar(db: AppDb, today: string): Promise<Record<string, [string, string][]>> {
  const horizon = addDays(today, 400);
  const reqs = await db
    .select({ carId: requests.carId, from: requests.dateFrom, to: requests.dateTo })
    .from(requests)
    .where(and(inArray(requests.status, [...BUSY_STATUSES]), gte(requests.dateTo, today), lte(requests.dateFrom, horizon)));
  const blocks = await db
    .select({ carId: carBlocks.carId, from: carBlocks.dateFrom, to: carBlocks.dateTo })
    .from(carBlocks)
    .where(and(gte(carBlocks.dateTo, today), lte(carBlocks.dateFrom, horizon)));
  const byCar: Record<string, Period[]> = {};
  for (const p of [...reqs, ...blocks]) (byCar[p.carId] ??= []).push({ from: p.from, to: p.to });
  return Object.fromEntries(Object.entries(byCar).map(([carId, list]) => [carId, mergePeriods(list)]));
}

/** Транзакция под блокировкой машины: две проверки занятости одной машины не идут параллельно */
export async function withCarLock<T>(db: AppDb, carId: string, fn: (tx: AppDb) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`car:${carId}`}))`);
    return fn(tx as unknown as AppDb);
  });
}
