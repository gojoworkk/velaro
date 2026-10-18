import { describe, it, expect } from 'vitest';
import { normalizePhone, todayMoscow, validateRequest } from '@/lib/validation';

const NOW = new Date('2026-10-15T12:00:00Z');
const valid = {
  name: 'Анна', phone: '+7 (999) 123-45-67', carId: 'huracan',
  dateFrom: '2026-10-20', dateTo: '2026-10-27', delivery: 'delivery', address: 'Тверская, 1', comment: '',
};

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '+79991234567'],
    ['89991234567', '+79991234567'],
    ['9991234567', '+79991234567'],
  ])('%s → %s', (raw, out) => expect(normalizePhone(raw)).toBe(out));
  it('короткий номер — null', () => expect(normalizePhone('+7 999 12')).toBeNull());
});

describe('todayMoscow', () => {
  it('в 22:00 UTC в Москве уже завтра', () => expect(todayMoscow(new Date('2026-10-15T22:00:00Z'))).toBe('2026-10-16'));
});

describe('validateRequest', () => {
  it('валидная заявка: телефон нормализован, пустой комментарий → null', () => {
    const r = validateRequest(valid, NOW);
    expect(r).toEqual({ ok: true, data: { ...valid, phone: '+79991234567', comment: null } });
  });
  it('самовывоз без адреса — ок, адрес null', () => {
    const r = validateRequest({ ...valid, delivery: 'pickup', address: '' }, NOW);
    expect(r.ok && r.data.address).toBeNull();
  });
  it.each([
    ['name', { name: '  ' }],
    ['phone', { phone: '123' }],
    ['carId', { carId: '' }],
    ['dateFrom', { dateFrom: '2026-10-14' }],
    ['dateFrom', { dateFrom: 'завтра' }],
    ['dateTo', { dateTo: '2026-10-19' }],
    ['dateTo', { dateTo: '2027-10-21' }],
    ['delivery', { delivery: 'teleport' }],
    ['address', { address: '' }],
    ['comment', { comment: 'x'.repeat(1001) }],
  ])('ошибка в поле %s', (field, patch) => {
    const r = validateRequest({ ...valid, ...patch }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });
  it('не объект — ошибки по полям', () => expect(validateRequest(null, NOW).ok).toBe(false));
});
