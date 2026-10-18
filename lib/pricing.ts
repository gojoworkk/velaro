export type Tier = { minDays: number; percent: number };

/** Скидки за срок по умолчанию — если в базе их нет. Ступени по возрастанию minDays */
export const DEFAULT_TIERS: readonly Tier[] = [
  { minDays: 1, percent: 0 },
  { minDays: 3, percent: 10 },
  { minDays: 7, percent: 20 },
  { minDays: 14, percent: 30 },
];

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Сутки аренды: разница дат, в один день — 1 сутки */
export function countDays(from: string, to: string): number {
  return Math.max(1, Math.round((toUtc(to) - toUtc(from)) / DAY_MS));
}

/** Скидка долей: 0.1 = 10% */
export function discountFor(days: number, tiers: readonly Tier[] = DEFAULT_TIERS): number {
  let percent = 0;
  for (const tier of tiers) if (days >= tier.minDays) percent = tier.percent;
  return percent / 100;
}

/** Цена за сутки со скидкой, округлённая до 100 ₽ */
export function dayRate(pricePerDay: number, days: number, tiers: readonly Tier[] = DEFAULT_TIERS): number {
  return Math.round((pricePerDay * (1 - discountFor(days, tiers))) / 100) * 100;
}

export function quote(pricePerDay: number, from: string, to: string, tiers: readonly Tier[] = DEFAULT_TIERS) {
  const days = countDays(from, to);
  const rate = dayRate(pricePerDay, days, tiers);
  return { days, dayRate: rate, total: rate * days };
}
