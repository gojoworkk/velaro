import { and, count, desc, eq, ilike, isNull, like, or, type SQL } from 'drizzle-orm';
import { cars, requestEvents, requests, users } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { SessionUser } from '@/lib/auth/session';
import { adminUrl, formatRequestMessage } from '@/lib/telegram';
import { isStatus, STATUSES, type Status } from './statuses';

export const PAGE_SIZE = 50;

export type ListRow = {
  id: number; createdAt: Date; name: string; phone: string; carName: string;
  dateFrom: string; dateTo: string; total: number; status: string; assigneeName: string | null;
};
export type ListResult = {
  rows: ListRow[]; counts: Record<Status | 'all', number>; total: number; page: number; pages: number; status: Status | 'all';
};
export type RequestEvent = {
  id: number; userId: number; type: 'status' | 'assign' | 'note'; fromValue: string | null; toValue: string | null;
  text: string | null; createdAt: Date; authorName: string;
};
export type RequestDetail = typeof requests.$inferSelect & {
  carName: string; assigneeName: string | null; events: RequestEvent[]; people: Record<string, string>;
};
export type ActionResult = { ok: true } | { ok: false; error: string };

const OK: ActionResult = { ok: true };
const NOT_FOUND: ActionResult = { ok: false, error: 'Заявка не найдена.' };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Поиск по имени (без учёта регистра) и по цифрам телефона; фильтр по машине */
function searchCondition(q?: string, car?: string): SQL | undefined {
  const conds: SQL[] = [];
  if (car) conds.push(eq(requests.carId, car));
  const text = q?.trim();
  if (text) {
    const byName = ilike(requests.name, `%${escapeLike(text)}%`);
    let digits = text.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    conds.push(digits.length >= 3 ? (or(byName, like(requests.phone, `%${digits}%`)) as SQL) : byName);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listRequests(
  db: AppDb,
  f: { status?: Status | 'all'; q?: string; car?: string; page?: number } = {},
): Promise<ListResult> {
  const base = searchCondition(f.q, f.car);
  const counts = Object.fromEntries([...STATUSES, 'all'].map((s) => [s, 0])) as Record<Status | 'all', number>;
  const grouped = await db.select({ status: requests.status, n: count() }).from(requests).where(base).groupBy(requests.status);
  for (const g of grouped) {
    if (isStatus(g.status)) counts[g.status] = g.n;
    counts.all += g.n;
  }

  const status = f.status ?? 'new';
  const total = counts[status];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(f.page ?? 1) || 1), pages);
  const rows = await db
    .select({
      id: requests.id, createdAt: requests.createdAt, name: requests.name, phone: requests.phone, carName: cars.name,
      dateFrom: requests.dateFrom, dateTo: requests.dateTo, total: requests.total, status: requests.status, assigneeName: users.name,
    })
    .from(requests)
    .innerJoin(cars, eq(cars.id, requests.carId))
    .leftJoin(users, eq(users.id, requests.assignedTo))
    .where(status === 'all' ? base : and(base, eq(requests.status, status)))
    .orderBy(desc(requests.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows, counts, total, page, pages, status };
}

export async function getRequest(db: AppDb, id: number): Promise<RequestDetail | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await db
    .select({ r: requests, carName: cars.name })
    .from(requests)
    .innerJoin(cars, eq(cars.id, requests.carId))
    .where(eq(requests.id, id));
  if (!row) return null;
  const people = Object.fromEntries((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [String(u.id), u.name]));
  const events = await db
    .select({
      id: requestEvents.id, userId: requestEvents.userId, type: requestEvents.type, fromValue: requestEvents.fromValue,
      toValue: requestEvents.toValue, text: requestEvents.text, createdAt: requestEvents.createdAt, authorName: users.name,
    })
    .from(requestEvents)
    .innerJoin(users, eq(users.id, requestEvents.userId))
    .where(eq(requestEvents.requestId, id))
    .orderBy(desc(requestEvents.id));
  const assigneeName = row.r.assignedTo ? (people[String(row.r.assignedTo)] ?? null) : null;
  return { ...row.r, carName: row.carName, assigneeName, events, people };
}

/** Взять в работу: побеждает первый — условие assigned_to IS NULL в самом UPDATE */
export async function takeRequest(db: AppDb, id: number, actor: SessionUser, now: Date): Promise<ActionResult> {
  return db.transaction(async (tx): Promise<ActionResult> => {
    const [taken] = await tx
      .update(requests)
      .set({ assignedTo: actor.id })
      .where(and(eq(requests.id, id), isNull(requests.assignedTo)))
      .returning({ status: requests.status });
    if (!taken) {
      const [cur] = await tx
        .select({ name: users.name })
        .from(requests)
        .leftJoin(users, eq(users.id, requests.assignedTo))
        .where(eq(requests.id, id));
      if (!cur) return NOT_FOUND;
      return { ok: false, error: `Заявку уже взял(а) ${cur.name}.` };
    }
    await tx.insert(requestEvents).values({ requestId: id, userId: actor.id, type: 'assign', fromValue: null, toValue: String(actor.id), createdAt: now });
    if (taken.status === 'new') {
      await tx.update(requests).set({ status: 'in_progress' }).where(eq(requests.id, id));
      await tx.insert(requestEvents).values({ requestId: id, userId: actor.id, type: 'status', fromValue: 'new', toValue: 'in_progress', createdAt: now });
    }
    return OK;
  });
}

export async function assignRequest(db: AppDb, id: number, actor: SessionUser, toUserId: number, now: Date): Promise<ActionResult> {
  const [r] = await db.select({ assignedTo: requests.assignedTo }).from(requests).where(eq(requests.id, id));
  if (!r) return NOT_FOUND;
  if (actor.role !== 'owner' && r.assignedTo !== actor.id) {
    return { ok: false, error: 'Передать заявку может только ответственный или владелец.' };
  }
  const [target] = Number.isInteger(toUserId)
    ? await db.select({ active: users.active }).from(users).where(eq(users.id, toUserId))
    : [];
  if (!target || !target.active) return { ok: false, error: 'Такого сотрудника нет или он отключён.' };
  if (r.assignedTo === toUserId) return OK;
  await db.update(requests).set({ assignedTo: toUserId }).where(eq(requests.id, id));
  await db.insert(requestEvents).values({
    requestId: id, userId: actor.id, type: 'assign',
    fromValue: r.assignedTo === null ? null : String(r.assignedTo), toValue: String(toUserId), createdAt: now,
  });
  return OK;
}

export async function setStatus(db: AppDb, id: number, actor: SessionUser, status: unknown, now: Date): Promise<ActionResult> {
  if (!isStatus(status)) return { ok: false, error: 'Неизвестный статус.' };
  const [r] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, id));
  if (!r) return NOT_FOUND;
  if (r.status === status) return OK;
  await db.update(requests).set({ status }).where(eq(requests.id, id));
  await db.insert(requestEvents).values({ requestId: id, userId: actor.id, type: 'status', fromValue: r.status, toValue: status, createdAt: now });
  return OK;
}

export async function addNote(db: AppDb, id: number, actor: SessionUser, text: unknown, now: Date): Promise<ActionResult> {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return { ok: false, error: 'Напишите текст заметки.' };
  if (t.length > 2000) return { ok: false, error: 'Заметка — до 2000 символов.' };
  const [r] = await db.select({ id: requests.id }).from(requests).where(eq(requests.id, id));
  if (!r) return NOT_FOUND;
  await db.insert(requestEvents).values({ requestId: id, userId: actor.id, type: 'note', text: t, createdAt: now });
  return OK;
}

export async function resendTelegram(
  db: AppDb,
  id: number,
  notify: (text: string) => Promise<boolean>,
  siteUrl?: string,
): Promise<ActionResult> {
  const [row] = await db
    .select({ r: requests, carName: cars.name })
    .from(requests)
    .innerJoin(cars, eq(cars.id, requests.carId))
    .where(eq(requests.id, id));
  if (!row) return NOT_FOUND;
  const { r } = row;
  const text = formatRequestMessage(
    {
      id: r.id, carName: row.carName, dateFrom: r.dateFrom, dateTo: r.dateTo, days: r.days, dayRate: r.dayRate,
      total: r.total, deposit: r.deposit, name: r.name, phone: r.phone, delivery: r.delivery, address: r.address, comment: r.comment,
    },
    adminUrl(siteUrl, r.id),
  );
  const sent = await notify(text).catch(() => false);
  if (!sent) return { ok: false, error: 'Telegram не ответил. Попробуйте позже.' };
  await db.update(requests).set({ telegramSent: true }).where(eq(requests.id, id));
  return OK;
}
