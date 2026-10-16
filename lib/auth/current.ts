import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Role } from '@/db/schema';
import { getDb } from '@/lib/db';
import { SESSION_COOKIE } from './cookie';
import { authorize } from './guard';
import { getSessionUser, type SessionUser } from './session';

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentUser(): Promise<SessionUser | null> {
  return getSessionUser(getDb(), await sessionToken(), new Date());
}

/** Для страниц и серверных функций: нет сессии → на вход, не хватает прав → 404 */
export async function requireUser(role?: Role, opts: { allowMustChange?: boolean } = {}): Promise<SessionUser> {
  const user = await currentUser();
  const verdict = authorize(user, role);
  if (verdict === 'login') {
    const path = (await headers()).get('x-admin-path') ?? '/admin';
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }
  if (verdict === 'forbidden') notFound();
  if (user!.mustChangePassword && !opts.allowMustChange) redirect('/admin/password');
  return user!;
}
