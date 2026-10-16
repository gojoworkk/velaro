import { describe, it, expect } from 'vitest';
import { users } from '@/db/schema';
import { login } from '@/lib/auth/login';
import { getSessionUser } from '@/lib/auth/session';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const NOW = new Date('2026-10-16T12:00:00Z');
const base = { ip: '1.1.1.1', salt: 's', now: NOW };

describe('login', () => {
  it('успех: сессия, last_login_at, логин без учёта регистра и пробелов', async () => {
    const db = await createTestDb();
    const u = await makeUser(db, { login: 'anna' });
    const res = await login(db, { ...base, login: '  ANNA ', password: 'password123' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.user).toEqual(u);
    expect(await getSessionUser(db, res.token, NOW)).toEqual(u);
    expect((await db.select().from(users))[0].lastLoginAt?.getTime()).toBe(NOW.getTime());
  });
  it('неверный пароль и несуществующий логин — одна и та же ошибка', async () => {
    const db = await createTestDb();
    await makeUser(db, { login: 'anna' });
    expect(await login(db, { ...base, login: 'anna', password: 'wrong-pass' })).toEqual({ ok: false, error: 'invalid' });
    expect(await login(db, { ...base, login: 'ghost', password: 'password123' })).toEqual({ ok: false, error: 'invalid' });
  });
  it('отключённый не входит', async () => {
    const db = await createTestDb();
    await makeUser(db, { login: 'anna', active: false });
    expect(await login(db, { ...base, login: 'anna', password: 'password123' })).toEqual({ ok: false, error: 'invalid' });
  });
  it('после 5 неудач — блокировка даже с верным паролем; через 15 минут снова можно', async () => {
    const db = await createTestDb();
    await makeUser(db, { login: 'anna' });
    for (let i = 0; i < 5; i++) await login(db, { ...base, login: 'anna', password: 'wrong-pass' });
    expect(await login(db, { ...base, login: 'anna', password: 'password123' })).toEqual({ ok: false, error: 'locked' });
    // другой IP не заблокирован
    expect((await login(db, { ...base, ip: '2.2.2.2', login: 'anna', password: 'password123' })).ok).toBe(true);
    const later = new Date(NOW.getTime() + 16 * 60_000);
    expect((await login(db, { ...base, now: later, login: 'anna', password: 'password123' })).ok).toBe(true);
  });
});
