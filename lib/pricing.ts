// Скидки за срок — те же, что на лендинге
const TIERS = [
  { minDays: 1, rate: 0 },
  { minDays: 3, rate: 0.1 },
  { minDays: 7, rate: 0.2 },
  { minDays: 14, rate: 0.3 },
] as const;

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Сутки аренды: разница дат, в один день — 1 сутки */
export function countDays(from: string, to: string): number {
  return Math.max(1, Math.round((toUtc(to) - toUtc(from)) / DAY_MS));
}

export function discountFor(days: number): number {
  let rate = 0;
  for (const tier of TIERS) if (days >= tier.minDays) rate = tier.rate;
  return rate;
}

/** Цена за сутки со скидкой, округлённая до 100 ₽ */
export function dayRate(pricePerDay: number, days: number): number {
  return Math.round((pricePerDay * (1 - discountFor(days))) / 100) * 100;
}

export function quote(pricePerDay: number, from: string, to: string) {
  const days = countDays(from, to);
  const rate = dayRate(pricePerDay, days);
  return { days, dayRate: rate, total: rate * days };
}
