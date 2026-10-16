'use server';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/admin/action-state';
import { addNote, assignRequest, resendTelegram, setStatus, takeRequest, type ActionResult } from '@/lib/admin/requests';
import { changeOwnPassword, createManager, resetPassword, setActive } from '@/lib/admin/users';
import { sendTelegram } from '@/lib/telegram';
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
  const next = safeNext(fd.get('next'));
  redirect(res.user.mustChangePassword ? `/admin/password?next=${encodeURIComponent(next)}` : next);
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
  redirect(safeNext(fd.get('next')));
}

function afterRequestChange(id: number, res: ActionResult): ActionState {
  revalidatePath(`/admin/requests/${id}`);
  revalidatePath('/admin');
  return res.ok ? { ok: true } : { error: res.error };
}

export async function takeAction(id: number, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return afterRequestChange(id, await takeRequest(getDb(), id, user, new Date()));
}

export async function assignAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return afterRequestChange(id, await assignRequest(getDb(), id, user, Number(fd.get('userId')), new Date()));
}

export async function statusAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return afterRequestChange(id, await setStatus(getDb(), id, user, fd.get('status'), new Date()));
}

export async function noteAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const text = str(fd, 'text');
  const state = afterRequestChange(id, await addNote(getDb(), id, user, text, new Date()));
  return state.error ? { ...state, values: { text } } : state;
}

export async function resendAction(id: number, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireUser();
  return afterRequestChange(id, await resendTelegram(getDb(), id, (t) => sendTelegram(t), process.env.SITE_URL));
}

export async function createManagerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireUser('owner');
  const input = { login: str(fd, 'login'), name: str(fd, 'name'), password: str(fd, 'password') };
  const res = await createManager(getDb(), owner, input);
  revalidatePath('/admin/managers');
  if (!res.ok) return { errors: res.errors, values: { login: input.login, name: input.name } };
  return { ok: true };
}

export async function resetPasswordAction(userId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireUser('owner');
  const res = await resetPassword(getDb(), owner, userId, str(fd, 'password'));
  revalidatePath('/admin/managers');
  return res.ok ? { ok: true } : { error: Object.values(res.errors)[0] };
}

export async function setActiveAction(userId: number, active: boolean, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const owner = await requireUser('owner');
  const res = await setActive(getDb(), owner, userId, active);
  revalidatePath('/admin/managers');
  return res.ok ? { ok: true } : { error: Object.values(res.errors)[0] };
}
