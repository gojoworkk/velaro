import { asc, desc, eq, max } from 'drizzle-orm';
import { cars, discountTiers, priceChanges, users, type PriceChangeKind } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { SessionUser } from '@/lib/auth/session';
import { rub } from '@/lib/format';
import { getTiers } from '@/lib/tiers';

export const CATEGORIES = { sport: 'Спорт', suv: 'Внедорожники', business: 'Бизнес' } as const;
export type Category = keyof typeof CATEGORIES;

/** Положение кадра в карточке: object-position по вертикали */
export const PHOTO_POSITIONS: Record<string, string> = { '50% 35%': 'Выше', '50% 60%': 'По центру', '50% 80%': 'Ниже' };

export type CarRow = typeof cars.$inferSelect;
export type CarInput = {
  name: string; category: Category; powerHp: number; accel0100: string; seats: number;
  pricePerDay: number; deposit: number; photoAlt: string; photoPos: string; active: boolean;
};
type Errors = Record<string, string>;

/** Целое из строки «70 000» → 70000; иначе NaN */
const int = (v: unknown) => {
  const s = String(v ?? '').replace(/[\s ]/g, '');
  return /^-?\d+$/.test(s) ? Number(s) : Number.NaN;
};
const between = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

export function validateCar(raw: Record<string, unknown>): { ok: true; data: CarInput } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const name = String(raw.name ?? '').trim();
  if (name.length < 2 || name.length > 60) errors.name = 'Название — от 2 до 60 символов.';
  const category = String(raw.category ?? '');
  if (!(category in CATEGORIES)) errors.category = 'Выберите класс.';
  const powerHp = int(raw.powerHp);
  if (!between(powerHp, 50, 2000)) errors.powerHp = 'Мощность — от 50 до 2000 л.с.';
  const accelText = String(raw.accel0100 ?? '').trim().replace(',', '.');
  const accel = /^\d+(\.\d+)?$/.test(accelText) ? Number(accelText) : Number.NaN;
  if (!(accel >= 1.5 && accel <= 20)) errors.accel0100 = 'Разгон до сотни — от 1,5 до 20 секунд.';
  const seats = int(raw.seats);
  if (!between(seats, 1, 9)) errors.seats = 'Мест — от 1 до 9.';
  const pricePerDay = int(raw.pricePerDay);
  if (!between(pricePerDay, 1000, 10_000_000)) errors.pricePerDay = 'Цена — от 1 000 до 10 000 000 ₽.';
  const deposit = int(raw.deposit);
  if (!between(deposit, 1000, 10_000_000)) errors.deposit = 'Депозит — от 1 000 до 10 000 000 ₽.';
  const photoAlt = String(raw.photoAlt ?? '').trim();
  if (photoAlt.length > 200) errors.photoAlt = 'Подпись к фото — до 200 символов.';
  const photoPos = String(raw.photoPos ?? '50% 60%').trim();
  if (!/^\d{1,3}% \d{1,3}%$/.test(photoPos)) errors.photoPos = 'Выберите положение кадра.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name, category: category as Category, powerHp, accel0100: accel.toFixed(1).replace('.', ','), seats,
      pricePerDay, deposit, photoAlt: photoAlt || name, photoPos, active: raw.active === true || raw.active === 'on',
    },
  };
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** «Lamborghini Huracán EVO» → «lamborghini-huracan-evo» */
export function slugify(name: string): string {
  const latin = [...name.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join('');
  const slug = latin
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'car';
}

export async function nextCarId(db: AppDb, name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db.select({ id: cars.id }).from(cars).where(eq(cars.id, id));
    if (!taken) return id;
  }
}

export async function listFleet(db: AppDb): Promise<CarRow[]> {
  return db.select().from(cars).orderBy(asc(cars.sortOrder), asc(cars.id));
}

export async function getCar(db: AppDb, id: string): Promise<CarRow | null> {
  const [car] = await db.select().from(cars).where(eq(cars.id, id));
  return car ?? null;
}

async function logChange(
  db: AppDb,
  actor: SessionUser,
  now: Date,
  e: { kind: PriceChangeKind; carId?: string; tier?: number; fromValue?: string | number | null; toValue?: string | number | null },
) {
  await db.insert(priceChanges).values({
    userId: actor.id, createdAt: now, kind: e.kind, carId: e.carId ?? null, tier: e.tier ?? null,
    fromValue: e.fromValue == null ? null : String(e.fromValue), toValue: e.toValue == null ? null : String(e.toValue),
  });
}

const carFields = (input: CarInput) => ({
  name: input.name, category: input.category, powerHp: input.powerHp, accel0100: input.accel0100, seats: input.seats,
  pricePerDay: input.pricePerDay, deposit: input.deposit, photoAlt: input.photoAlt, photoPos: input.photoPos, active: input.active,
});

export async function createCar(db: AppDb, actor: SessionUser, id: string, input: CarInput, photoUrl: string, now: Date): Promise<void> {
  const [{ last }] = await db.select({ last: max(cars.sortOrder) }).from(cars);
  await db.insert(cars).values({ id, ...carFields(input), photoUrl, sortOrder: (last ?? -1) + 1, updatedAt: now });
  await logChange(db, actor, now, { kind: 'created', carId: id, toValue: input.pricePerDay });
}

export async function updateCar(
  db: AppDb,
  actor: SessionUser,
  id: string,
  input: CarInput,
  photoUrl: string | null,
  now: Date,
): Promise<{ ok: true; oldPhotoUrl: string | null } | { ok: false; error: string }> {
  const cur = await getCar(db, id);
  if (!cur) return { ok: false, error: 'Машина не найдена.' };
  await db.update(cars).set({ ...carFields(input), ...(photoUrl ? { photoUrl } : {}), updatedAt: now }).where(eq(cars.id, id));
  if (cur.pricePerDay !== input.pricePerDay) {
    await logChange(db, actor, now, { kind: 'price', carId: id, fromValue: cur.pricePerDay, toValue: input.pricePerDay });
  }
  if (cur.deposit !== input.deposit) {
    await logChange(db, actor, now, { kind: 'deposit', carId: id, fromValue: cur.deposit, toValue: input.deposit });
  }
  if (cur.active !== input.active) await logChange(db, actor, now, { kind: input.active ? 'shown' : 'hidden', carId: id });
  return { ok: true, oldPhotoUrl: photoUrl && photoUrl !== cur.photoUrl ? cur.photoUrl : null };
}

export async function setCarActive(
  db: AppDb,
  actor: SessionUser,
  id: string,
  active: boolean,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cur = await getCar(db, id);
  if (!cur) return { ok: false, error: 'Машина не найдена.' };
  if (cur.active === active) return { ok: true };
  await db.update(cars).set({ active, updatedAt: now }).where(eq(cars.id, id));
  await logChange(db, actor, now, { kind: active ? 'shown' : 'hidden', carId: id });
  return { ok: true };
}

/** Сдвинуть машину на одну позицию; порядок заодно нормализуется в 0..n-1 */
export async function moveCar(db: AppDb, id: string, dir: -1 | 1): Promise<void> {
  const list = await db.select({ id: cars.id }).from(cars).orderBy(asc(cars.sortOrder), asc(cars.id));
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (let k = 0; k < list.length; k++) await tx.update(cars).set({ sortOrder: k }).where(eq(cars.id, list[k].id));
  });
}

export async function saveTiers(
  db: AppDb,
  actor: SessionUser,
  rows: { minDays: unknown; percent: unknown }[],
  now: Date,
): Promise<{ ok: true } | { ok: false; errors: Errors }> {
  if (rows.length !== 4) return { ok: false, errors: { form: 'Нужно ровно 4 ступени скидок.' } };
  const errors: Errors = {};
  const next = rows.map((r, i) => ({ minDays: i === 0 ? 1 : int(r.minDays), percent: int(r.percent) }));
  next.forEach((t, i) => {
    const key = `tier${i + 1}`;
    if (!between(t.percent, 0, 90)) errors[key] = 'Скидка — целое число от 0 до 90%.';
    else if (i > 0 && !between(t.minDays, 2, 365)) errors[key] = 'Срок — целое число суток от 2 до 365.';
    else if (i > 0 && t.minDays <= next[i - 1].minDays) errors[key] = 'Срок должен быть больше, чем у предыдущей ступени.';
  });
  if (Object.keys(errors).length) return { ok: false, errors };

  const cur = await getTiers(db);
  for (let i = 0; i < 4; i++) {
    const t = next[i];
    await db
      .insert(discountTiers)
      .values({ position: i + 1, ...t })
      .onConflictDoUpdate({ target: discountTiers.position, set: { minDays: t.minDays, percent: t.percent } });
    if (cur[i].percent !== t.percent) {
      await logChange(db, actor, now, { kind: 'tier_percent', tier: i + 1, fromValue: cur[i].percent, toValue: t.percent });
    }
    if (cur[i].minDays !== t.minDays) {
      await logChange(db, actor, now, { kind: 'tier_days', tier: i + 1, fromValue: cur[i].minDays, toValue: t.minDays });
    }
  }
  return { ok: true };
}

export type PriceLogRow = {
  id: number; createdAt: Date; authorName: string; carName: string | null; kind: PriceChangeKind;
  tier: number | null; fromValue: string | null; toValue: string | null;
};

export async function listPriceLog(db: AppDb, limit = 200): Promise<PriceLogRow[]> {
  return db
    .select({
      id: priceChanges.id, createdAt: priceChanges.createdAt, authorName: users.name, carName: cars.name,
      kind: priceChanges.kind, tier: priceChanges.tier, fromValue: priceChanges.fromValue, toValue: priceChanges.toValue,
    })
    .from(priceChanges)
    .innerJoin(users, eq(users.id, priceChanges.userId))
    .leftJoin(cars, eq(cars.id, priceChanges.carId))
    .orderBy(desc(priceChanges.createdAt), desc(priceChanges.id))
    .limit(limit);
}

const money = (v: string | null) => rub(Number(v ?? 0));

/** Строка журнала: «Mercedes-AMG G 63: цена 65 000 ₽ → 70 000 ₽» */
export function describeChange(r: PriceLogRow): string {
  const car = r.carName ?? 'Машина';
  switch (r.kind) {
    case 'price': return `${car}: цена ${money(r.fromValue)} → ${money(r.toValue)}`;
    case 'deposit': return `${car}: депозит ${money(r.fromValue)} → ${money(r.toValue)}`;
    case 'created': return `${car}: добавлена, ${money(r.toValue)} в сутки`;
    case 'hidden': return `${car}: скрыта с сайта`;
    case 'shown': return `${car}: снова на сайте`;
    case 'tier_percent': return `Скидка ${r.tier}: ${r.fromValue}% → ${r.toValue}%`;
    case 'tier_days': return `Скидка ${r.tier}: от ${r.fromValue} → от ${r.toValue} суток`;
  }
}
