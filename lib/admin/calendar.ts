import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { carBlocks, cars, requests, users } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { SessionUser } from '@/lib/auth/session';
import { addDays, BUSY_STATUSES, describeConflict, findConflicts, withCarLock } from '@/lib/availability';
import { listFleet } from './fleet';

const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** «2026-10» из адреса; неверное значение — текущий месяц */
export function parseMonth(raw: unknown, today: string): string {
  const s = String(raw ?? '');
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? s : today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export const monthTitle = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

const monthBounds = (month: string) => ({
  first: `${month}-01`,
  last: addDays(`${shiftMonth(month, 1)}-01`, -1),
});

export type Bar = {
  kind: 'request' | 'block'; id: number; label: string; from: string; to: string;
  /** День месяца, с которого начинается полоса, и её длина в днях */
  start: number; span: number;
  /** Полоса продолжается в соседнем месяце */
  cutStart: boolean; cutEnd: boolean;
};
export type MonthGrid = {
  month: string;
  days: { iso: string; day: number; weekend: boolean; today: boolean }[];
  rows: { carId: string; name: string; active: boolean; bars: Bar[] }[];
};

export async function monthGrid(db: AppDb, month: string, today: string): Promise<MonthGrid> {
  const { first, last } = monthBounds(month);
  const days: MonthGrid['days'] = [];
  for (let iso = first; iso <= last; iso = addDays(iso, 1)) {
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    days.push({ iso, day: Number(iso.slice(8)), weekend: dow === 0 || dow === 6, today: iso === today });
  }
  const bar = (kind: Bar['kind'], id: number, label: string, from: string, to: string): Bar => {
    const a = from < first ? first : from;
    const b = to > last ? last : to;
    const start = Number(a.slice(8));
    return { kind, id, label, from, to, start, span: Number(b.slice(8)) - start + 1, cutStart: from < first, cutEnd: to > last };
  };
  const reqs = await db
    .select({ id: requests.id, carId: requests.carId, name: requests.name, from: requests.dateFrom, to: requests.dateTo })
    .from(requests)
    .where(and(inArray(requests.status, [...BUSY_STATUSES]), lte(requests.dateFrom, last), gte(requests.dateTo, first)));
  const blocks = await db
    .select({ id: carBlocks.id, carId: carBlocks.carId, reason: carBlocks.reason, from: carBlocks.dateFrom, to: carBlocks.dateTo })
    .from(carBlocks)
    .where(and(lte(carBlocks.dateFrom, last), gte(carBlocks.dateTo, first)));
  const fleet = await listFleet(db);
  return {
    month,
    days,
    rows: fleet.map((c) => ({
      carId: c.id,
      name: c.name,
      active: c.active,
      bars: [
        ...reqs.filter((r) => r.carId === c.id).map((r) => bar('request', r.id, `№${r.id} ${r.name}`, r.from, r.to)),
        ...blocks.filter((b) => b.carId === c.id).map((b) => bar('block', b.id, b.reason, b.from, b.to)),
      ].sort((x, y) => x.start - y.start),
    })),
  };
}

export async function addBlock(
  db: AppDb,
  actor: SessionUser,
  raw: { carId: unknown; from: unknown; to: unknown; reason: unknown },
  today: string,
  now: Date,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const carId = String(raw.carId ?? '');
  const from = String(raw.from ?? '');
  const to = String(raw.to ?? '');
  const reason = String(raw.reason ?? '').trim();
  const [car] = carId ? await db.select({ id: cars.id }).from(cars).where(eq(cars.id, carId)) : [];
  if (!car) errors.carId = 'Выберите машину.';
  if (!isIso(from)) errors.from = 'Укажите дату начала.';
  else if (from > addDays(today, 730)) errors.from = 'Не дальше чем на 2 года вперёд.';
  if (!isIso(to)) errors.to = 'Укажите дату окончания.';
  else if (isIso(from) && to < from) errors.to = 'Окончание не может быть раньше начала.';
  else if (to < today) errors.to = 'Дата окончания уже прошла.';
  if (!reason || reason.length > 100) errors.reason = 'Укажите причину (до 100 символов).';
  if (Object.keys(errors).length) return { ok: false, errors };

  return withCarLock(db, carId, async (tx) => {
    const [c] = await findConflicts(tx, carId, { from, to });
    if (c) {
      const form = c.kind === 'request'
        ? `Пересекается: ${describeConflict(c)}. Сначала отмените или перенесите её.`
        : `Пересекается с другой блокировкой: ${describeConflict(c)}.`;
      return { ok: false as const, errors: { form } };
    }
    await tx.insert(carBlocks).values({ carId, dateFrom: from, dateTo: to, reason, createdBy: actor.id, createdAt: now });
    return { ok: true as const };
  });
}

export async function removeBlock(db: AppDb, id: number): Promise<void> {
  if (Number.isInteger(id)) await db.delete(carBlocks).where(eq(carBlocks.id, id));
}

export type BlockRow = { id: number; carId: string; carName: string; from: string; to: string; reason: string; authorName: string };

export async function listBlocks(db: AppDb, month: string): Promise<BlockRow[]> {
  const { first, last } = monthBounds(month);
  return db
    .select({
      id: carBlocks.id, carId: carBlocks.carId, carName: cars.name, from: carBlocks.dateFrom, to: carBlocks.dateTo,
      reason: carBlocks.reason, authorName: users.name,
    })
    .from(carBlocks)
    .innerJoin(cars, eq(cars.id, carBlocks.carId))
    .innerJoin(users, eq(users.id, carBlocks.createdBy))
    .where(and(lte(carBlocks.dateFrom, last), gte(carBlocks.dateTo, first)))
    .orderBy(asc(carBlocks.dateFrom));
}
