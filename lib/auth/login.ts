import { createHash } from 'node:crypto';
import { and, count, eq, gt, lt } from 'drizzle-orm';
import { loginAttempts, users } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { normalizeLogin } from '@/lib/admin/users';
import { hashPassword, verifyPassword } from './password';
import { createSession, type SessionUser } from './session';

const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const KEEP_MS = 24 * 60 * 60_000;

export type LoginResult = { ok: true; token: string; user: SessionUser } | { ok: false; error: 'invalid' | 'locked' };

export const LOGIN_ERRORS: Record<'invalid' | 'locked', string> = {
  invalid: 'Неверный логин или пароль.',
  locked: 'Слишком много попыток. Попробуйте через 15 минут.',
};

// Если логина нет, всё равно считаем scrypt — время ответа не выдаёт, существует ли логин
let dummyHash: Promise<string> | null = null;

export async function login(
  db: AppDb,
  input: { login: string; password: string; ip: string; salt: string; now: Date },
): Promise<LoginResult> {
  const name = normalizeLogin(input.login);
  const now = input.now;
  const key = createHash('sha256').update(`${input.salt}:${name}:${input.ip}`).digest('hex');

  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now.getTime() - KEEP_MS)));
  const [{ value }] = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, new Date(now.getTime() - WINDOW_MS))));
  if (value >= MAX_FAILS) return { ok: false, error: 'locked' };

  const [u] = await db.select().from(users).where(eq(users.login, name));
  dummyHash ??= hashPassword('velaro-dummy-password');
  const passwordOk = await verifyPassword(input.password, u?.passwordHash ?? (await dummyHash));
  if (!u || !u.active || !passwordOk) {
    await db.insert(loginAttempts).values({ key, createdAt: now });
    return { ok: false, error: 'invalid' };
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, u.id));
  const token = await createSession(db, u.id, now);
  return { ok: true, token, user: { id: u.id, login: u.login, name: u.name, role: u.role, mustChangePassword: u.mustChangePassword } };
}
