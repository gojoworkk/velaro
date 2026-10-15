import { describe, it, expect } from 'vitest';
import { countDays, discountFor, dayRate, quote } from '@/lib/pricing';

describe('countDays', () => {
  it('в один день — 1 сутки', () => expect(countDays('2026-10-20', '2026-10-20')).toBe(1));
  it('разница дат', () => expect(countDays('2026-10-20', '2026-10-27')).toBe(7));
  it('через границу месяцев', () => expect(countDays('2026-10-30', '2026-11-02')).toBe(3));
});

describe('discountFor', () => {
  it.each([[1, 0], [2, 0], [3, 0.1], [6, 0.1], [7, 0.2], [13, 0.2], [14, 0.3], [40, 0.3]])(
    '%i суток → %f', (days, rate) => expect(discountFor(days)).toBe(rate),
  );
});

describe('dayRate', () => {
  it('без скидки', () => expect(dayRate(95000, 2)).toBe(95000));
  it('округляет до 100 ₽', () => expect(dayRate(65000, 3)).toBe(58500));
  it('−20% на 7 суток', () => expect(dayRate(150000, 7)).toBe(120000));
});

describe('quote', () => {
  it('итог = цена за сутки × сутки', () =>
    expect(quote(150000, '2026-10-20', '2026-10-27')).toEqual({ days: 7, dayRate: 120000, total: 840000 }));
});
