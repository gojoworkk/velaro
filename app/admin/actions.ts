'use server';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/admin/action-state';
import { addNote, assignRequest, resendTelegram, setStatus, takeRequest, type ActionResult } from '@/lib/admin/requests';
import { createCar, moveCar, nextCarId, saveTiers, setCarActive, updateCar, validateCar } from '@/lib/admin/fleet';
import { getPhotoStore, photoError, photoName, type PhotoStore } from '@/lib/photo-store';
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

function revalidateFleet() {
  revalidatePath('/admin/cars', 'layout');
  revalidatePath('/api/catalog');
}

export async function setCarActiveAction(id: string, active: boolean, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const res = await setCarActive(getDb(), user, id, active, new Date());
  revalidateFleet();
  return res.ok ? { ok: true } : { error: res.error };
}

export async function moveCarAction(id: string, dir: -1 | 1, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireUser();
  await moveCar(getDb(), id, dir);
  revalidateFleet();
  return { ok: true };
}

export async function saveTiersAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const rows = [1, 2, 3, 4].map((i) => ({ minDays: str(fd, `minDays${i}`), percent: str(fd, `percent${i}`) }));
  const res = await saveTiers(getDb(), user, rows, new Date());
  revalidateFleet();
  const values = Object.fromEntries(rows.flatMap((r, i) => [[`minDays${i + 1}`, r.minDays], [`percent${i + 1}`, r.percent]]));
  return res.ok ? { ok: true } : { errors: res.errors, values };
}

const CAR_FIELDS = ['name', 'category', 'powerHp', 'accel0100', 'seats', 'pricePerDay', 'deposit', 'photoAlt', 'photoPos'] as const;
const NO_STORE = 'Не подключено хранилище фото (Vercel Blob). Без нового фото остальные поля сохранить можно.';

function readCarForm(fd: FormData) {
  const values = Object.fromEntries(CAR_FIELDS.map((k) => [k, str(fd, k)])) as Record<string, string>;
  const file = fd.get('photo');
  const photo = file instanceof File && file.size > 0 ? file : null;
  return { values, photo, check: validateCar({ ...values, active: fd.get('active') ?? undefined }) };
}

function photoStoreOrNull(): PhotoStore | null {
  try {
    return getPhotoStore();
  } catch {
    return null;
  }
}

export async function createCarAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { values, photo, check } = readCarForm(fd);
  const errors: Record<string, string> = { ...(check.ok ? {} : check.errors) };
  const pErr = photoError(photo);
  if (pErr) errors.photo = pErr;
  if (!check.ok || pErr || !photo) return { errors, values };
  const store = photoStoreOrNull();
  if (!store) return { error: NO_STORE, values };
  const db = getDb();
  const id = await nextCarId(db, check.data.name);
  const url = await store.put(photoName(id, photo.type), Buffer.from(await photo.arrayBuffer()), photo.type);
  await createCar(db, user, id, check.data, url, new Date());
  revalidateFleet();
  redirect('/admin/cars');
}

export async function updateCarAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { values, photo, check } = readCarForm(fd);
  const errors: Record<string, string> = { ...(check.ok ? {} : check.errors) };
  const pErr = photo ? photoError(photo) : null;
  if (pErr) errors.photo = pErr;
  if (!check.ok || pErr) return { errors, values };
  let url: string | null = null;
  let store: PhotoStore | null = null;
  if (photo) {
    store = photoStoreOrNull();
    if (!store) return { error: NO_STORE, values };
    url = await store.put(photoName(id, photo.type), Buffer.from(await photo.arrayBuffer()), photo.type);
  }
  const res = await updateCar(getDb(), user, id, check.data, url, new Date());
  if (!res.ok) return { error: res.error, values };
  if (store && res.oldPhotoUrl) await store.remove(res.oldPhotoUrl);
  revalidateFleet();
  redirect('/admin/cars');
}
