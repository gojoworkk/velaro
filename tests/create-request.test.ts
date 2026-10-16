import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createRequest, type CreateDeps } from '@/lib/create-request';
import { cars, requests } from '@/db/schema';
import { createTestDb } from './helpers/test-db';

const body = {
  name: 'Анна', phone: '+7 999 123-45-67', carId: 'huracan',
  dateFrom: '2026-10-20', dateTo: '2026-10-27', delivery: 'delivery', address: 'Тверская, 1', comment: '',
  website: '',
};
const deps = (over: Partial<CreateDeps> = {}): CreateDeps => ({
  ip: '1.2.3.4', now: new Date('2026-10-15T12:00:00Z'), salt: 's', notify: vi.fn().mockResolvedValue(true), ...over,
});

describe('createRequest', () => {
  it('сохраняет заявку с ценой из базы и шлёт уведомление', async () => {
    const db = await createTestDb();
    const d = deps();
    const res = await createRequest(db, { ...body, total: 1 }, d);
    expect(res).toEqual({ status: 201, id: 1 });
    const [row] = await db.select().from(requests);
    expect(row).toMatchObject({ carId: 'huracan', phone: '+79991234567', days: 7, dayRate: 120000, total: 840000, deposit: 300000, status: 'new', telegramSent: true });
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('Новая заявка №1'));
  });
  it('ловушка для ботов: фиктивный успех, в базе пусто', async () => {
    const db = await createTestDb();
    const d = deps();
    expect(await createRequest(db, { ...body, website: 'http://spam' }, d)).toEqual({ status: 200, id: 0 });
    expect(await db.select().from(requests)).toHaveLength(0);
    expect(d.notify).not.toHaveBeenCalled();
  });
  it('ошибки полей — 400', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, { ...body, phone: '1' }, deps());
    expect(res.status).toBe(400);
    expect(res.status === 400 && res.errors.phone).toBeTruthy();
  });
  it('несуществующая или скрытая машина — 400 по carId', async () => {
    const db = await createTestDb();
    await db.update(cars).set({ active: false }).where(eq(cars.id, 'urus'));
    for (const carId of ['nope', 'urus']) {
      const res = await createRequest(db, { ...body, carId }, deps());
      expect(res.status === 400 && res.errors.carId).toBeTruthy();
    }
  });
  it('шестая заявка за 10 минут — 429', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await createRequest(db, body, deps());
    expect(await createRequest(db, body, deps())).toEqual({ status: 429 });
  });
  it('Telegram недоступен — заявка сохранена, telegramSent=false', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, body, deps({ notify: vi.fn().mockResolvedValue(false) }));
    expect(res.status).toBe(201);
    const [row] = await db.select().from(requests);
    expect(row.telegramSent).toBe(false);
  });
  it('с siteUrl в уведомлении есть ссылка на карточку', async () => {
    const db = await createTestDb();
    const d = deps({ siteUrl: 'https://velaro.test' });
    await createRequest(db, body, d);
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('href="https://velaro.test/admin/requests/1"'));
  });
  it('notify бросает — заявка всё равно сохранена', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, body, deps({ notify: vi.fn().mockRejectedValue(new Error('x')) }));
    expect(res.status).toBe(201);
  });
});
