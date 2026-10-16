import { createHash, randomBytes } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { sessions, users, type Role } from '@/db/schema';
import type { AppDb } from '@/db/types';

const DAY = 86_400_000;
export const SESSION_TTL_MS = 30 * DAY;
const RENEW_BELOW_MS = 15 * DAY;

export type SessionUser = { id: number; login: string; name: string; role: Role; mustChangePassword: boolean };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Создаёт сессию и возвращает токен для cookie; в базе остаётся только его хэш */
export async function createSession(db: AppDb, userId: number, now: Date): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export async function getSessionUser(db: AppDb, token: string | null | undefined, now: Date): Promise<SessionUser | null> {
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      active: users.active,
      id: users.id,
      login: users.login,
      name: users.name,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  if (!row.active || row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (row.expiresAt.getTime() - now.getTime() < RENEW_BELOW_MS) {
    await db.update(sessions).set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS) }).where(eq(sessions.id, id));
  }
  return { id: row.id, login: row.login, name: row.name, role: row.role, mustChangePassword: row.mustChangePassword };
}

export async function deleteSession(db: AppDb, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Выкидывает пользователя со всех устройств (кроме текущей сессии, если она передана) */
export async function deleteUserSessions(db: AppDb, userId: number, exceptToken?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(exceptToken ? and(eq(sessions.userId, userId), ne(sessions.id, hashToken(exceptToken))) : eq(sessions.userId, userId));
}
