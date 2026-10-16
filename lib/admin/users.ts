import { asc, eq } from 'drizzle-orm';
import { users, type Role } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { hashPassword } from '@/lib/auth/password';
import { deleteUserSessions, type SessionUser } from '@/lib/auth/session';

export type UserResult = { ok: true } | { ok: false; errors: Record<string, string> };
export type UserRow = { id: number; login: string; name: string; role: Role; active: boolean; lastLoginAt: Date | null };
export type NewUser = { login: string; name: string; password: string };

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;
const OK: UserResult = { ok: true };
const fail = (errors: Record<string, string>): UserResult => ({ ok: false, errors });
const FORBIDDEN = fail({ form: 'Недостаточно прав.' });

export const normalizeLogin = (s: string) => s.trim().toLowerCase();

function passwordError(p: string): string | null {
  if (p.length < 8) return 'Пароль — минимум 8 символов.';
  if (p.length > 200) return 'Слишком длинный пароль.';
  return null;
}

async function insertUser(db: AppDb, input: NewUser, role: Role, mustChangePassword: boolean): Promise<UserResult> {
  const login = normalizeLogin(input.login);
  const name = input.name.trim();
  const errors: Record<string, string> = {};
  if (!LOGIN_RE.test(login)) errors.login = 'Логин: 3–32 символа — латиница, цифры, точка, дефис, подчёркивание.';
  if (!name || name.length > 60) errors.name = 'Укажите имя (до 60 символов).';
  const pe = passwordError(input.password);
  if (pe) errors.password = pe;
  if (Object.keys(errors).length) return fail(errors);

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.login, login));
  if (taken) return fail({ login: 'Такой логин уже занят.' });
  await db.insert(users).values({ login, name, role, mustChangePassword, passwordHash: await hashPassword(input.password) });
  return OK;
}

/** Первый и единственный владелец — создаётся скриптом из терминала */
export async function createOwner(db: AppDb, input: NewUser): Promise<UserResult> {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'owner'));
  if (owner) return fail({ form: 'Владелец уже создан.' });
  return insertUser(db, input, 'owner', false);
}

export async function createManager(db: AppDb, actor: SessionUser, input: NewUser): Promise<UserResult> {
  if (actor.role !== 'owner') return FORBIDDEN;
  return insertUser(db, input, 'manager', true);
}

export async function listUsers(db: AppDb): Promise<UserRow[]> {
  return db
    .select({ id: users.id, login: users.login, name: users.name, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(users)
    .orderBy(asc(users.id));
}

/** Менеджер, которым может управлять владелец; владельца трогать нельзя */
async function manageable(db: AppDb, actor: SessionUser, userId: number): Promise<UserResult> {
  if (actor.role !== 'owner') return FORBIDDEN;
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!u) return fail({ form: 'Сотрудник не найден.' });
  if (u.role === 'owner') return fail({ form: 'Владельца изменить нельзя.' });
  return OK;
}

export async function resetPassword(db: AppDb, actor: SessionUser, userId: number, password: string): Promise<UserResult> {
  const check = await manageable(db, actor, userId);
  if (!check.ok) return check;
  const pe = passwordError(password);
  if (pe) return fail({ password: pe });
  await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true }).where(eq(users.id, userId));
  await deleteUserSessions(db, userId);
  return OK;
}

export async function setActive(db: AppDb, actor: SessionUser, userId: number, active: boolean): Promise<UserResult> {
  const check = await manageable(db, actor, userId);
  if (!check.ok) return check;
  await db.update(users).set({ active }).where(eq(users.id, userId));
  if (!active) await deleteUserSessions(db, userId);
  return OK;
}

export async function changeOwnPassword(
  db: AppDb,
  userId: number,
  password: string,
  confirm: string,
  keepToken: string,
): Promise<UserResult> {
  const pe = passwordError(password);
  if (pe) return fail({ password: pe });
  if (password !== confirm) return fail({ confirm: 'Пароли не совпадают.' });
  await db.update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: false }).where(eq(users.id, userId));
  await deleteUserSessions(db, userId, keepToken);
  return OK;
}
