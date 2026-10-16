import { describe, it, expect } from 'vitest';
import { isStatus, STATUSES, STATUS_LABELS } from '@/lib/admin/statuses';

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
