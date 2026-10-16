'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/admin/action-state';
import { changeOwnPassword } from '@/lib/admin/users';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';
import { requireUser, sessionToken } from '@/lib/auth/current';
import { safeNext } from '@/lib/auth/guard';
import { login, LOGIN_ERRORS } from '@/lib/auth/login';
import { deleteSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

const str = (fd: FormData, key: string) => String(fd.get(key) ?? '');

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const loginValue = str(fd, 'login');
  const ip = ((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const res = await login(getDb(), {
    login: loginValue,
    password: str(fd, 'password'),
    ip,
    salt: process.env.IP_HASH_SALT ?? 'local-dev-salt',
    now: new Date(),
  });
  if (!res.ok) return { error: LOGIN_ERRORS[res.error], values: { login: loginValue } };
  (await cookies()).set(SESSION_COOKIE, res.token, sessionCookieOptions());
  redirect(res.user.mustChangePassword ? '/admin/password' : safeNext(fd.get('next')));
}

export async function logoutAction(): Promise<void> {
  const token = await sessionToken();
  if (token) await deleteSession(getDb(), token);
  (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  redirect('/admin/login');
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(undefined, { allowMustChange: true });
  const res = await changeOwnPassword(getDb(), user.id, str(fd, 'password'), str(fd, 'confirm'), (await sessionToken()) ?? '');
  if (!res.ok) return { errors: res.errors };
  redirect('/admin');
}
