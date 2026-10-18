import { describe, it, expect } from 'vitest';
import { carBlocks, requests } from '@/db/schema';
import type { AppDb } from '@/db/types';
import {
  addDays, busyByCar, describeConflict, findConflicts, mergePeriods, overlaps, withCarLock,
} from '@/lib/availability';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

async function addRequest(db: AppDb, over: Partial<typeof requests.$inferInsert> = {}) {
  const [r] = await db.insert(requests).values({
    name: 'Анна', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-20', dateTo: '2026-10-23',
    delivery: 'pickup', days: 3, dayRate: 58500, total: 175500, deposit: 150000, ...over,
  }).returning();
  return r;
}

describe('периоды', () => {
  it('пересечение включительно: день возврата занят', () => {
    expect(overlaps({ from: '2026-10-20', to: '2026-10-23' }, { from: '2026-10-23', to: '2026-10-25' })).toBe(true);
    expect(overlaps({ from: '2026-10-20', to: '2026-10-23' }, { from: '2026-10-24', to: '2026-10-25' })).toBe(false);
  });
  it('addDays через границу месяца', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'));
  it('слияние пересекающихся и соседних', () => {
    expect(mergePeriods([
      { from: '2026-11-01', to: '2026-11-03' },
      { from: '2026-10-20', to: '2026-10-23' },
      { from: '2026-10-24', to: '2026-10-25' },
      { from: '2026-11-02', to: '2026-11-05' },
    ])).toEqual([['2026-10-20', '2026-10-25'], ['2026-11-01', '2026-11-05']]);
  });
});

describe('findConflicts', () => {
  it('учитывает подтверждённые и завершённые заявки и блокировки; новые — нет', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const confirmed = await addRequest(db, { status: 'confirmed' });
    await addRequest(db, { status: 'new', dateFrom: '2026-10-22', dateTo: '2026-10-22' });
    await addRequest(db, { status: 'cancelled' });
    const completed = await addRequest(db, { status: 'completed', dateFrom: '2026-10-01', dateTo: '2026-10-05' });
    const [block] = await db.insert(carBlocks).values({
      carId: 'g63', dateFrom: '2026-10-26', dateTo: '2026-10-27', reason: 'ТО', createdBy: u.id, createdAt: new Date(),
    }).returning();
    const c = await findConflicts(db, 'g63', { from: '2026-10-05', to: '2026-10-26' });
    expect(c.map((x) => `${x.kind}:${x.id}`).sort()).toEqual(
      [`block:${block.id}`, `request:${confirmed.id}`, `request:${completed.id}`].sort());
    expect(await findConflicts(db, 'urus', { from: '2026-10-01', to: '2026-10-31' })).toEqual([]);
    expect(await findConflicts(db, 'g63', { from: '2026-10-20', to: '2026-10-23' }, { excludeRequestId: confirmed.id })).toEqual([]);
  });
  it('описание конфликта', () => {
    expect(plain(describeConflict({ kind: 'request', id: 5, from: '2026-10-20', to: '2026-10-23' }))).toBe('заявка №5, 20–23 октября');
    expect(plain(describeConflict({ kind: 'block', id: 1, reason: 'ТО', from: '2026-10-30', to: '2026-11-02' }))).toBe('ТО, 30 октября — 2 ноября');
  });
});

describe('busyByCar', () => {
  it('только будущее, только даты, слито', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    await addRequest(db, { status: 'confirmed', dateFrom: '2026-10-01', dateTo: '2026-10-05' }); // прошло
    await addRequest(db, { status: 'confirmed', dateFrom: '2026-10-20', dateTo: '2026-10-23' });
    await db.insert(carBlocks).values({ carId: 'g63', dateFrom: '2026-10-24', dateTo: '2026-10-25', reason: 'ТО', createdBy: u.id, createdAt: new Date() });
    await addRequest(db, { status: 'confirmed', carId: 'urus', dateFrom: '2028-01-01', dateTo: '2028-01-02' }); // дальше 13 месяцев
    expect(await busyByCar(db, '2026-10-18')).toEqual({ g63: [['2026-10-20', '2026-10-25']] });
  });
});

describe('withCarLock', () => {
  it('выполняет функцию в транзакции и возвращает её результат', async () => {
    const db = await createTestDb();
    expect(await withCarLock(db, 'g63', async (tx) => (await findConflicts(tx, 'g63', { from: '2026-10-01', to: '2026-10-02' })).length)).toBe(0);
  });
});
