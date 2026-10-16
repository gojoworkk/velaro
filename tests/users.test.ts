import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { sessions, users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionUser } from '@/lib/auth/session';
import { changeOwnPassword, createManager, createOwner, listUsers, resetPassword, setActive } from '@/lib/admin/users';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const NOW = new Date('2026-10-16T12:00:00Z');

describe('createOwner', () => {
  it('создаёт владельца без обязательной смены пароля; второго — нельзя', async () => {
    const db = await createTestDb();
    expect(await createOwner(db, { login: ' Boss ', name: 'Владелец', password: 'password123' })).toEqual({ ok: true });
    const [u] = await db.select().from(users);
    expect(u).toMatchObject({ login: 'boss', role: 'owner', mustChangePassword: false });
    expect(await verifyPassword('password123', u.passwordHash)).toBe(true);
    const again = await createOwner(db, { login: 'boss2', name: 'Ещё', password: 'password123' });
    expect(again.ok).toBe(false);
  });
});

describe('createManager', () => {
  it('владелец создаёт менеджера с обязательной сменой пароля', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    expect(await createManager(db, owner, { login: 'ivan', name: 'Иван', password: 'temp-pass1' })).toEqual({ ok: true });
    const [u] = await db.select().from(users).where(eq(users.login, 'ivan'));
    expect(u).toMatchObject({ role: 'manager', mustChangePassword: true, active: true });
  });
  it('ошибки полей и занятый логин', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    const bad = await createManager(db, owner, { login: 'ив', name: ' ', password: 'short' });
    expect(bad.ok === false && Object.keys(bad.errors).sort()).toEqual(['login', 'name', 'password']);
    const taken = await createManager(db, owner, { login: 'BOSS', name: 'X', password: 'password123' });
    expect(taken.ok === false && taken.errors.login).toBe('Такой логин уже занят.');
  });
  it('менеджер не может создавать менеджеров', async () => {
    const db = await createTestDb();
    const m = await makeUser(db);
    const res = await createManager(db, m, { login: 'ivan', name: 'Иван', password: 'password123' });
    expect(res.ok === false && res.errors.form).toBe('Недостаточно прав.');
  });
});

describe('resetPassword и setActive', () => {
  it('сброс пароля: новый хэш, флаг смены, все сессии удалены', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    const m = await makeUser(db, { login: 'ivan' });
    await createSession(db, m.id, NOW);
    expect(await resetPassword(db, owner, m.id, 'new-temp-1')).toEqual({ ok: true });
    const [u] = await db.select().from(users).where(eq(users.id, m.id));
    expect(u.mustChangePassword).toBe(true);
    expect(await verifyPassword('new-temp-1', u.passwordHash)).toBe(true);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
  it('отключение удаляет сессии, включение возвращает доступ', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    const m = await makeUser(db, { login: 'ivan' });
    const token = await createSession(db, m.id, NOW);
    expect(await setActive(db, owner, m.id, false)).toEqual({ ok: true });
    expect(await getSessionUser(db, token, NOW)).toBeNull();
    expect(await setActive(db, owner, m.id, true)).toEqual({ ok: true });
    expect((await listUsers(db)).find((u) => u.id === m.id)?.active).toBe(true);
  });
  it('владельца нельзя отключить или сбросить; менеджер ничего не может', async () => {
    const db = await createTestDb();
    const owner = await makeUser(db, { login: 'boss', role: 'owner' });
    const m = await makeUser(db, { login: 'ivan' });
    expect((await setActive(db, owner, owner.id, false)).ok).toBe(false);
    expect((await resetPassword(db, owner, owner.id, 'password123')).ok).toBe(false);
    expect((await setActive(db, m, owner.id, false)).ok).toBe(false);
    expect((await resetPassword(db, m, m.id, 'password123')).ok).toBe(false);
  });
});

describe('changeOwnPassword', () => {
  it('меняет пароль, снимает флаг, оставляет только текущую сессию', async () => {
    const db = await createTestDb();
    const m = await makeUser(db, { mustChangePassword: true });
    const keep = await createSession(db, m.id, NOW);
    const other = await createSession(db, m.id, NOW);
    expect(await changeOwnPassword(db, m.id, 'my-new-pass', 'my-new-pass', keep)).toEqual({ ok: true });
    const [u] = await db.select().from(users);
    expect(u.mustChangePassword).toBe(false);
    expect(await verifyPassword('my-new-pass', u.passwordHash)).toBe(true);
    expect(await getSessionUser(db, keep, NOW)).not.toBeNull();
    expect(await getSessionUser(db, other, NOW)).toBeNull();
  });
  it('короткий пароль и несовпадение', async () => {
    const db = await createTestDb();
    const m = await makeUser(db);
    const short = await changeOwnPassword(db, m.id, '123', '123', 't');
    expect(short.ok === false && short.errors.password).toBeTruthy();
    const diff = await changeOwnPassword(db, m.id, 'password-a', 'password-b', 't');
    expect(diff.ok === false && diff.errors.confirm).toBe('Пароли не совпадают.');
  });
});
