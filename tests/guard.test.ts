import { describe, it, expect } from 'vitest';
import { authorize, safeNext } from '@/lib/auth/guard';
import type { SessionUser } from '@/lib/auth/session';

const manager: SessionUser = { id: 2, login: 'ivan', name: 'Иван', role: 'manager', mustChangePassword: false };
const owner: SessionUser = { ...manager, id: 1, role: 'owner' };

describe('authorize', () => {
  it('без сессии — на вход', () => expect(authorize(null)).toBe('login'));
  it('менеджер проходит общий доступ, но не доступ владельца', () => {
    expect(authorize(manager)).toBe('ok');
    expect(authorize(manager, 'owner')).toBe('forbidden');
    expect(authorize(owner, 'owner')).toBe('ok');
  });
});

describe('safeNext', () => {
  it.each([
    ['/admin/requests/5', '/admin/requests/5'],
    ['/admin?status=all', '/admin?status=all'],
    ['/admin', '/admin'],
    ['https://evil.com', '/admin'],
    ['//evil.com', '/admin'],
    ['/adminka', '/admin'],
    ['/admin/login', '/admin'],
    ['/admin/password', '/admin'],
    [undefined, '/admin'],
  ])('%s → %s', (input, out) => expect(safeNext(input)).toBe(out));
});
