import { users, type Role } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { hashPassword } from '@/lib/auth/password';
import type { SessionUser } from '@/lib/auth/session';

let cachedHash: Promise<string> | null = null;

/** Пользователь в тестовой базе; пароль по умолчанию «password123» */
export async function makeUser(
  db: AppDb,
  over: { login?: string; name?: string; role?: Role; active?: boolean; mustChangePassword?: boolean; password?: string } = {},
): Promise<SessionUser> {
  cachedHash ??= hashPassword('password123');
  const passwordHash = over.password ? await hashPassword(over.password) : await cachedHash;
  const [u] = await db
    .insert(users)
    .values({
      login: over.login ?? 'anna',
      name: over.name ?? 'Анна',
      role: over.role ?? 'manager',
      active: over.active ?? true,
      mustChangePassword: over.mustChangePassword ?? false,
      passwordHash,
    })
    .returning();
  return { id: u.id, login: u.login, name: u.name, role: u.role, mustChangePassword: u.mustChangePassword };
}
