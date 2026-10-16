import type { Role } from '@/db/schema';
import type { SessionUser } from './session';

export function authorize(user: SessionUser | null, role?: Role): 'ok' | 'login' | 'forbidden' {
  if (!user) return 'login';
  if (role === 'owner' && user.role !== 'owner') return 'forbidden';
  return 'ok';
}

/** Куда вернуть после входа: только страницы админки, иначе — список заявок */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string') return '/admin';
  const inAdmin = next === '/admin' || next.startsWith('/admin/') || next.startsWith('/admin?');
  if (!inAdmin || next.includes('\\') || next.startsWith('/admin/login') || next.startsWith('/admin/password')) return '/admin';
  return next;
}
