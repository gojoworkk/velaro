import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { sessions, users } from '@/db/schema';
import { createSession, deleteSession, deleteUserSessions, getSessionUser, hashToken } from '@/lib/auth/session';
import { createTestDb } from './helpers/test-db';
import { makeUser } from './helpers/users';

const NOW = new Date('2026-10-16T12:00:00Z');
const DAY = 86_400_000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

describe('сессии', () => {
  it('в базе только хэш токена; по токену находится пользователь', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const token = await createSession(db, u.id, NOW);
    const [row] = await db.select().from(sessions);
    expect(row.id).toBe(hashToken(token));
    expect(row.id).not.toBe(token);
    expect(row.expiresAt.getTime()).toBe(at(30).getTime());
    expect(await getSessionUser(db, token, NOW)).toEqual(u);
  });
  it('пустой и чужой токен — null', async () => {
    const db = await createTestDb();
    expect(await getSessionUser(db, undefined, NOW)).toBeNull();
    expect(await getSessionUser(db, 'nope', NOW)).toBeNull();
  });
  it('истёкшая сессия — null и удаляется', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const token = await createSession(db, u.id, NOW);
    expect(await getSessionUser(db, token, at(31))).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
  it('продлевается, если осталось меньше 15 дней', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const token = await createSession(db, u.id, NOW);
    await getSessionUser(db, token, at(10)); // осталось 20 — не трогаем
    expect((await db.select().from(sessions))[0].expiresAt.getTime()).toBe(at(30).getTime());
    await getSessionUser(db, token, at(20)); // осталось 10 — продлеваем на 30 от «сейчас»
    expect((await db.select().from(sessions))[0].expiresAt.getTime()).toBe(at(50).getTime());
  });
  it('отключённый пользователь не проходит', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const token = await createSession(db, u.id, NOW);
    await db.update(users).set({ active: false }).where(eq(users.id, u.id));
    expect(await getSessionUser(db, token, NOW)).toBeNull();
  });
  it('выход и удаление всех сессий, кроме текущей', async () => {
    const db = await createTestDb();
    const u = await makeUser(db);
    const a = await createSession(db, u.id, NOW);
    const b = await createSession(db, u.id, NOW);
    const c = await createSession(db, u.id, NOW);
    await deleteSession(db, a);
    expect(await getSessionUser(db, a, NOW)).toBeNull();
    await deleteUserSessions(db, u.id, b);
    expect(await getSessionUser(db, b, NOW)).not.toBeNull();
    expect(await getSessionUser(db, c, NOW)).toBeNull();
    await deleteUserSessions(db, u.id);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});
