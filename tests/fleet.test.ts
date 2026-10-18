import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { cars, priceChanges } from '@/db/schema';
import {
  createCar, describeChange, getCar, listFleet, listPriceLog, moveCar, nextCarId, saveTiers, setCarActive,
  slugify, updateCar, validateCar, type CarInput, type PriceLogRow,
} from '@/lib/admin/fleet';
import { getTiers } from '@/lib/tiers';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const NOW = new Date('2026-10-18T12:00:00Z');
// Intl ставит неразрывные пробелы в суммах — для сравнения заменяем обычными
const plain = (s: string) => s.replace(/[  ]/g, ' ');
const say = (r: PriceLogRow) => plain(describeChange(r));
const raw = {
  name: 'Audi RS6', category: 'business', powerHp: '630', accel0100: '3.4', seats: '5',
  pricePerDay: '70 000', deposit: '150000', photoAlt: '', photoPos: '50% 60%', active: 'on',
};
const input = (over: Partial<CarInput> = {}): CarInput => ({ ...(validateCar(raw) as { ok: true; data: CarInput }).data, ...over });

describe('validateCar', () => {
  it('нормализует числа, разгон и подпись к фото', () => {
    expect(validateCar(raw)).toEqual({ ok: true, data: {
      name: 'Audi RS6', category: 'business', powerHp: 630, accel0100: '3,4', seats: 5,
      pricePerDay: 70000, deposit: 150000, photoAlt: 'Audi RS6', photoPos: '50% 60%', active: true,
    } });
  });
  it('ошибки по каждому полю', () => {
    const r = validateCar({ name: 'A', category: 'truck', powerHp: '10', accel0100: 'быстро', seats: '0',
      pricePerDay: '500', deposit: '-1', photoAlt: 'x'.repeat(201), photoPos: 'center' });
    expect(r.ok === false && Object.keys(r.errors).sort()).toEqual(
      ['accel0100', 'category', 'deposit', 'name', 'photoAlt', 'photoPos', 'powerHp', 'pricePerDay', 'seats']);
  });
  it('без галочки — скрыта', () => {
    const r = validateCar({ ...raw, active: undefined });
    expect(r.ok && r.data.active).toBe(false);
  });
});

describe('slugify и nextCarId', () => {
  it.each([
    ['Lamborghini Huracán EVO', 'lamborghini-huracan-evo'],
    ['Майбах S 680', 'maybah-s-680'],
    ['  !!! ', 'car'],
  ])('%s → %s', (name, slug) => expect(slugify(name)).toBe(slug));
  it('занятый id получает номер', async () => {
    const db = await createTestDb();
    expect(await nextCarId(db, 'Ferrari Roma')).toBe('ferrari-roma-2');
    expect(await nextCarId(db, 'Audi RS6')).toBe('audi-rs6');
  });
});

describe('машины', () => {
  it('создание — в конец списка, с записью в журнале', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    await createCar(db, anna, 'audi-rs6', input(), 'https://x/rs6.jpg', NOW);
    const list = await listFleet(db);
    expect(list.at(-1)).toMatchObject({ id: 'audi-rs6', photoUrl: 'https://x/rs6.jpg', sortOrder: 9, pricePerDay: 70000 });
    const [log] = await listPriceLog(db);
    expect(log).toMatchObject({ kind: 'created', carName: 'Audi RS6', authorName: 'Анна', toValue: '70000' });
    expect(say(log)).toBe('Audi RS6: добавлена, 70 000 ₽ в сутки');
  });
  it('правка цены и депозита — по записи на каждое изменение; без нового фото старое остаётся', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const g63 = (await getCar(db, 'g63'))!;
    const res = await updateCar(db, anna, 'g63', input({ name: g63.name, category: 'suv', pricePerDay: 70000, deposit: 160000 }), null, NOW);
    expect(res).toEqual({ ok: true, oldPhotoUrl: null });
    expect((await getCar(db, 'g63'))!.photoUrl).toBe(g63.photoUrl);
    expect((await listPriceLog(db)).map(say).sort()).toEqual([
      'Mercedes-AMG G 63: депозит 150 000 ₽ → 160 000 ₽',
      'Mercedes-AMG G 63: цена 65 000 ₽ → 70 000 ₽',
    ]);
  });
  it('новое фото — возвращает старый адрес для удаления', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    const old = (await getCar(db, 'm5'))!.photoUrl;
    const res = await updateCar(db, anna, 'm5', input({ name: 'BMW M5 Competition', pricePerDay: 40000, deposit: 100000 }), 'https://x/new.jpg', NOW);
    expect(res).toEqual({ ok: true, oldPhotoUrl: old });
    expect(await db.select().from(priceChanges)).toHaveLength(0);
  });
  it('скрыть и вернуть — пишется в журнал; несуществующая машина — ошибка', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    expect(await setCarActive(db, anna, 'urus', false, NOW)).toEqual({ ok: true });
    expect((await getCar(db, 'urus'))!.active).toBe(false);
    await setCarActive(db, anna, 'urus', true, new Date(NOW.getTime() + 1000));
    expect((await listPriceLog(db)).map(say)).toEqual(['Lamborghini Urus: снова на сайте', 'Lamborghini Urus: скрыта с сайта']);
    expect(await setCarActive(db, anna, 'nope', false, NOW)).toEqual({ ok: false, error: 'Машина не найдена.' });
    expect((await updateCar(db, anna, 'nope', input(), null, NOW)).ok).toBe(false);
  });
  it('порядок: вверх и вниз, края не ломают список', async () => {
    const db = await createTestDb();
    await moveCar(db, 'ferrari-roma', -1);
    expect((await listFleet(db)).slice(0, 2).map((c) => c.id)).toEqual(['ferrari-roma', 'gt3rs']);
    await moveCar(db, 'ferrari-roma', -1);
    await moveCar(db, 'bentley', 1);
    const ids = (await listFleet(db)).map((c) => c.id);
    expect([ids[0], ids.at(-1)]).toEqual(['ferrari-roma', 'bentley']);
    expect((await listFleet(db)).map((c) => c.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('скидки', () => {
  const rows = [{ minDays: 1, percent: 0 }, { minDays: 3, percent: 15 }, { minDays: 10, percent: 20 }, { minDays: 30, percent: 40 }];
  it('сохраняет и пишет в журнал только изменённое', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    expect(await saveTiers(db, anna, rows.map((r) => ({ minDays: String(r.minDays), percent: String(r.percent) })), NOW)).toEqual({ ok: true });
    expect(await getTiers(db)).toEqual(rows);
    expect((await listPriceLog(db)).map(say).sort()).toEqual([
      'Скидка 2: 10% → 15%',
      'Скидка 3: от 7 → от 10 суток',
      'Скидка 4: 30% → 40%',
      'Скидка 4: от 14 → от 30 суток',
    ]);
  });
  it('первая ступень всегда с 1 суток; порядок и диапазоны проверяются', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    await saveTiers(db, anna, [{ minDays: 5, percent: 0 }, ...rows.slice(1)], NOW);
    expect((await getTiers(db))[0].minDays).toBe(1);
    const bad = await saveTiers(db, anna, [rows[0], { minDays: 3, percent: 95 }, { minDays: 3, percent: 20 }, { minDays: 400, percent: 'x' }], NOW);
    expect(bad.ok === false && Object.keys(bad.errors).sort()).toEqual(['tier2', 'tier3', 'tier4']);
    expect((await saveTiers(db, anna, rows.slice(0, 3), NOW)).ok).toBe(false);
  });
});

describe('журнал', () => {
  it('новые сверху, не больше лимита', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    await setCarActive(db, anna, 'm5', false, NOW);
    await setCarActive(db, anna, 'm5', true, new Date(NOW.getTime() + 1000));
    const log = await listPriceLog(db, 1);
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe('shown');
  });
  it('запись хранит автора и ссылается на машину', async () => {
    const db = await createTestDb();
    const anna = await makeUser(db);
    await setCarActive(db, anna, 'm5', false, NOW);
    const [row] = await db.select().from(priceChanges).where(eq(priceChanges.carId, 'm5'));
    expect(row.userId).toBe(anna.id);
    expect((await db.select().from(cars)).length).toBe(9);
  });
});
