import { describe, it, expect } from 'vitest';
import { carBlocks, requests } from '@/db/schema';
import { addBlock, listBlocks, monthGrid, monthTitle, parseMonth, removeBlock, shiftMonth } from '@/lib/admin/calendar';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const TODAY = '2026-10-18';
const NOW = new Date('2026-10-18T12:00:00Z');
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('месяц', () => {
  it('parseMonth, shiftMonth, monthTitle', () => {
    expect(parseMonth('2026-11', TODAY)).toBe('2026-11');
    expect(parseMonth('2026-13', TODAY)).toBe('2026-10');
    expect(parseMonth(undefined, TODAY)).toBe('2026-10');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthTitle('2026-10')).toBe('Октябрь 2026');
  });
});

describe('monthGrid', () => {
  it('дни месяца, полосы заявок и блокировок с обрезкой по краям', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    await db.insert(requests).values({
      name: 'Анна', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-29', dateTo: '2026-11-02', delivery: 'pickup',
      days: 4, dayRate: 1, total: 4, deposit: 1, status: 'confirmed',
    });
    await db.insert(requests).values({
      name: 'Новый', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-05', dateTo: '2026-10-06', delivery: 'pickup',
      days: 1, dayRate: 1, total: 1, deposit: 1, status: 'new',
    });
    await db.insert(carBlocks).values({ carId: 'urus', dateFrom: '2026-09-28', dateTo: '2026-10-02', reason: 'ТО', createdBy: u.id, createdAt: NOW });
    const g = await monthGrid(db, '2026-10', TODAY);
    expect(g.days).toHaveLength(31);
    expect(g.days[17]).toMatchObject({ iso: '2026-10-18', today: true });
    expect(g.days[2].weekend).toBe(true); // 3 октября 2026 — суббота
    const g63 = g.rows.find((r) => r.carId === 'g63')!;
    expect(g63.bars).toEqual([{ kind: 'request', id: 1, label: '№1 Анна', from: '2026-10-29', to: '2026-11-02', start: 29, span: 3, cutStart: false, cutEnd: true }]);
    const urus = g.rows.find((r) => r.carId === 'urus')!;
    expect(urus.bars[0]).toMatchObject({ kind: 'block', label: 'ТО', start: 1, span: 2, cutStart: true, cutEnd: false });
    expect(g.rows[0].carId).toBe('gt3rs');
  });
});

describe('блокировки', () => {
  it('добавить, пересечение с подтверждённой — ошибка, с новой — можно, удалить', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    await db.insert(requests).values({
      name: 'Анна', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-20', dateTo: '2026-10-23', delivery: 'pickup',
      days: 3, dayRate: 1, total: 3, deposit: 1, status: 'confirmed',
    });
    await db.insert(requests).values({
      name: 'Новый', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-25', dateTo: '2026-10-26', delivery: 'pickup',
      days: 1, dayRate: 1, total: 1, deposit: 1, status: 'new',
    });
    const bad = await addBlock(db, u, { carId: 'g63', from: '2026-10-23', to: '2026-10-24', reason: 'ТО' }, TODAY, NOW);
    expect(bad.ok === false && plain(bad.errors.form)).toBe('Пересекается: заявка №1, 20–23 октября. Сначала отмените или перенесите её.');
    expect(await addBlock(db, u, { carId: 'g63', from: '2026-10-24', to: '2026-10-26', reason: ' Ремонт ' }, TODAY, NOW)).toEqual({ ok: true });
    const again = await addBlock(db, u, { carId: 'g63', from: '2026-10-26', to: '2026-10-27', reason: 'ТО' }, TODAY, NOW);
    expect(again.ok === false && plain(again.errors.form)).toBe('Пересекается с другой блокировкой: Ремонт, 24–26 октября.');
    const [row] = await listBlocks(db, '2026-10');
    expect(row).toMatchObject({ carId: 'g63', carName: 'Mercedes-AMG G 63', from: '2026-10-24', to: '2026-10-26', reason: 'Ремонт', authorName: 'Анна' });
    await removeBlock(db, row.id);
    expect(await listBlocks(db, '2026-10')).toEqual([]);
  });
  it('проверки полей', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const r = await addBlock(db, u, { carId: 'nope', from: '2026-10-25', to: '2026-10-20', reason: '' }, TODAY, NOW);
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(['carId', 'reason', 'to']);
    const past = await addBlock(db, u, { carId: 'g63', from: '2026-10-01', to: '2026-10-02', reason: 'ТО' }, TODAY, NOW);
    expect(past.ok === false && past.errors.to).toBe('Дата окончания уже прошла.');
    const far = await addBlock(db, u, { carId: 'g63', from: '2029-01-01', to: '2029-01-02', reason: 'ТО' }, TODAY, NOW);
    expect(far.ok === false && far.errors.from).toBe('Не дальше чем на 2 года вперёд.');
  });
});
