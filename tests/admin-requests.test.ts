import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { requestEvents, requests } from '@/db/schema';
import type { AppDb } from '@/db/types';
import {
  addNote, assignRequest, getRequest, listRequests, resendTelegram, setStatus, takeRequest,
} from '@/lib/admin/requests';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const NOW = new Date('2026-10-16T12:00:00Z');

async function addRequest(db: AppDb, over: Partial<typeof requests.$inferInsert> = {}) {
  const [r] = await db.insert(requests).values({
    name: 'Анна Смирнова', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-20', dateTo: '2026-10-23',
    delivery: 'pickup', days: 3, dayRate: 58500, total: 175500, deposit: 150000, ...over,
  }).returning();
  return r;
}

describe('listRequests', () => {
  it('по умолчанию новые, свежие сверху, со счётчиками по всем статусам', async () => {
    const db = await createTestDb();
    const a = await addRequest(db);
    const b = await addRequest(db, { name: 'Борис', phone: '+79035550000', carId: 'urus' });
    await addRequest(db, { status: 'confirmed' });
    const res = await listRequests(db);
    expect(res.status).toBe('new');
    expect(res.rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(res.rows[0]).toMatchObject({ carName: 'Lamborghini Urus', assigneeName: null });
    expect(res.counts).toMatchObject({ all: 3, new: 2, confirmed: 1, in_progress: 0 });
  });
  it('поиск по имени и по цифрам телефона, фильтр по машине', async () => {
    const db = await createTestDb();
    await addRequest(db);
    await addRequest(db, { name: 'Борис', phone: '+79035550000', carId: 'urus' });
    expect((await listRequests(db, { status: 'all', q: 'смирн' })).rows).toHaveLength(1);
    expect((await listRequests(db, { status: 'all', q: '903 555' })).rows[0].name).toBe('Борис');
    expect((await listRequests(db, { status: 'all', q: '8 903 555 00 00' })).rows[0].name).toBe('Борис');
    // начало номера с восьмёрки — как набирают в России
    expect((await listRequests(db, { status: 'all', q: '8 903 555' })).rows[0]?.name).toBe('Борис');
    expect((await listRequests(db, { status: 'all', q: '+7 903' })).rows[0]?.name).toBe('Борис');
    expect((await listRequests(db, { status: 'all', car: 'g63' })).rows).toHaveLength(1);
    expect((await listRequests(db, { status: 'all', q: '%' })).rows).toHaveLength(0);
  });
  it('страницы по 50', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 51; i++) await addRequest(db);
    const p1 = await listRequests(db, { page: 1 });
    const p2 = await listRequests(db, { page: 2 });
    expect([p1.rows.length, p2.rows.length, p1.pages]).toEqual([50, 1, 2]);
    expect((await listRequests(db, { page: 99 })).page).toBe(2);
  });
});

describe('takeRequest', () => {
  it('назначает, переводит в работу и пишет две записи истории', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const r = await addRequest(db);
    expect(await takeRequest(db, r.id, anna, NOW)).toEqual({ ok: true });
    const d = await getRequest(db, r.id);
    expect(d).toMatchObject({ assignedTo: anna.id, assigneeName: 'Анна', status: 'in_progress' });
    expect(d!.events.map((e) => e.type).sort()).toEqual(['assign', 'status']);
  });
  it('уже взята — ошибка с именем; одновременные нажатия — побеждает один', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const ivan = await makeUser(db, { login: 'ivan', name: 'Иван' });
    const r = await addRequest(db);
    const results = await Promise.all([takeRequest(db, r.id, anna, NOW), takeRequest(db, r.id, ivan, NOW)]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    const loser = results.find((x) => !x.ok);
    expect(loser && !loser.ok && loser.error).toMatch(/^Заявку уже взял\(а\) (Анна|Иван)\.$/);
    expect(await db.select().from(requestEvents).where(eq(requestEvents.type, 'assign'))).toHaveLength(1);
  });
  it('несуществующая заявка', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    expect(await takeRequest(db, 999, anna, NOW)).toEqual({ ok: false, error: 'Заявка не найдена.' });
  });
});

describe('assignRequest', () => {
  it('ответственный передаёт; посторонний менеджер — нет; владелец — может всегда', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', name: 'Босс', role: 'owner' });
    const anna = await makeUser(db);
    const ivan = await makeUser(db, { login: 'ivan', name: 'Иван' });
    const r = await addRequest(db);
    await takeRequest(db, r.id, anna, NOW);
    expect((await assignRequest(db, r.id, ivan, ivan.id, NOW)).ok).toBe(false);
    expect(await assignRequest(db, r.id, anna, ivan.id, NOW)).toEqual({ ok: true });
    expect(await assignRequest(db, r.id, owner, anna.id, NOW)).toEqual({ ok: true });
    const d = await getRequest(db, r.id);
    expect(d!.assignedTo).toBe(anna.id);
    expect(d!.events.filter((e) => e.type === 'assign')).toHaveLength(3);
  });
  it('нельзя передать отключённому', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    const off = await makeUser(db, { login: 'off', active: false });
    const r = await addRequest(db);
    expect((await assignRequest(db, r.id, owner, off.id, NOW)).ok).toBe(false);
  });
});

describe('setStatus и addNote', () => {
  it('смена статуса пишется в историю; тот же статус — без записи; чужой статус — ошибка', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const r = await addRequest(db);
    expect(await setStatus(db, r.id, anna, 'confirmed', NOW)).toEqual({ ok: true });
    expect(await setStatus(db, r.id, anna, 'confirmed', NOW)).toEqual({ ok: true });
    expect(await setStatus(db, r.id, anna, 'deleted', NOW)).toEqual({ ok: false, error: 'Неизвестный статус.' });
    const d = await getRequest(db, r.id);
    expect(d!.status).toBe('confirmed');
    expect(d!.events).toHaveLength(1);
    expect(d!.events[0]).toMatchObject({ type: 'status', fromValue: 'new', toValue: 'confirmed', authorName: 'Анна' });
  });
  it('заметка: обрезает пробелы, пустая и длинная — ошибка', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const r = await addRequest(db);
    expect(await addNote(db, r.id, anna, '  перезвонить в 18:00  ', NOW)).toEqual({ ok: true });
    expect((await addNote(db, r.id, anna, '   ', NOW)).ok).toBe(false);
    expect((await addNote(db, r.id, anna, 'x'.repeat(2001), NOW)).ok).toBe(false);
    const d = await getRequest(db, r.id);
    expect(d!.events.map((e) => e.text)).toEqual(['перезвонить в 18:00']);
  });
});

describe('getRequest и resendTelegram', () => {
  it('несуществующая и мусорный id — null', async () => {
    const db = await createTestDb();
    expect(await getRequest(db, 5)).toBeNull();
    expect(await getRequest(db, Number.NaN)).toBeNull();
  });
  it('повторная отправка ставит telegramSent и передаёт ссылку', async () => {
    const db = await createTestDb();
    const r = await addRequest(db);
    const notify = vi.fn().mockResolvedValue(true);
    expect(await resendTelegram(db, r.id, notify, 'https://x.ru')).toEqual({ ok: true });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Mercedes-AMG G 63'));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('https://x.ru/admin/requests/'));
    expect((await getRequest(db, r.id))!.telegramSent).toBe(true);
  });
  it('Telegram не ответил — ошибка, флаг не меняется', async () => {
    const db = await createTestDb();
    const r = await addRequest(db);
    const res = await resendTelegram(db, r.id, vi.fn().mockResolvedValue(false));
    expect(res.ok).toBe(false);
    expect((await getRequest(db, r.id))!.telegramSent).toBe(false);
  });
});
