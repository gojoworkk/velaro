import { and, eq } from 'drizzle-orm';
import { cars, requests } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { validateRequest } from './validation';
import { quote } from './pricing';
import { hashIp, checkRateLimit } from './rate-limit';
import { getTiers } from './tiers';
import { adminUrl, formatRequestMessage } from './telegram';

export type CreateDeps = {
  ip: string;
  now: Date;
  salt: string;
  notify: (text: string) => Promise<boolean>;
  /** Адрес сайта для ссылки на карточку в админке */
  siteUrl?: string;
};

export type CreateResult =
  | { status: 201; id: number }
  | { status: 200; id: 0 }
  | { status: 400; errors: Record<string, string> }
  | { status: 429 };

export async function createRequest(db: AppDb, body: unknown, deps: CreateDeps): Promise<CreateResult> {
  // Невидимое поле заполняют только боты — делаем вид, что всё хорошо
  const honeypot = (body as { website?: unknown } | null)?.website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') return { status: 200, id: 0 };

  if (!(await checkRateLimit(db, hashIp(deps.ip, deps.salt), deps.now))) return { status: 429 };

  const v = validateRequest(body, deps.now);
  if (!v.ok) return { status: 400, errors: v.errors };
  const input = v.data;

  const [car] = await db.select().from(cars).where(and(eq(cars.id, input.carId), eq(cars.active, true)));
  if (!car) return { status: 400, errors: { carId: 'Этот автомобиль сейчас недоступен — выберите другой.' } };

  // Цена — только из базы; всё, что прислал браузер про деньги, игнорируется
  const price = quote(car.pricePerDay, input.dateFrom, input.dateTo, await getTiers(db));
  const [row] = await db
    .insert(requests)
    .values({ ...input, days: price.days, dayRate: price.dayRate, total: price.total, deposit: car.deposit })
    .returning({ id: requests.id });

  let sent = false;
  try {
    sent = await deps.notify(
      formatRequestMessage({ id: row.id, carName: car.name, ...input, ...price, deposit: car.deposit }, adminUrl(deps.siteUrl, row.id)),
    );
  } catch {
    sent = false;
  }
  if (sent) await db.update(requests).set({ telegramSent: true }).where(eq(requests.id, row.id));

  return { status: 201, id: row.id };
}
