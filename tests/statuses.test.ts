import { describe, it, expect } from 'vitest';
import { describeEvent, isStatus, STATUSES, STATUS_LABELS } from '@/lib/admin/statuses';

describe('статусы', () => {
  it('пять статусов с подписями', () => {
    expect(STATUSES).toEqual(['new', 'in_progress', 'confirmed', 'completed', 'cancelled']);
    expect(STATUS_LABELS.in_progress).toBe('В работе');
  });
  it('isStatus', () => {
    expect(isStatus('confirmed')).toBe(true);
    expect(isStatus('deleted')).toBe(false);
    expect(isStatus(undefined)).toBe(false);
  });
});

describe('describeEvent', () => {
  const people = { '1': 'Анна', '2': 'Иван' };
  const base = { id: 1, userId: 1, fromValue: null, toValue: null, text: null, createdAt: new Date(), authorName: 'Анна' };
  // Пол сотрудника неизвестен — нейтральные формы «взял(а)», «передал(а)»
  it.each([
    [{ ...base, type: 'assign' as const, toValue: '1' }, 'Анна взял(а) в работу'],
    [{ ...base, type: 'assign' as const, fromValue: '1', toValue: '2' }, 'Анна передал(а) заявку: Иван'],
    [{ ...base, type: 'status' as const, fromValue: 'new', toValue: 'confirmed' }, 'Анна: Новая → Подтверждена'],
    [{ ...base, type: 'note' as const, text: 'привет' }, 'Анна, заметка'],
  ])('%#', (e, text) => expect(describeEvent(e, people)).toBe(text));
});
