import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';

// Для /admin: передаёт текущий путь страницам (для ?next=), продлевает cookie, запрещает индексацию
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-admin-path', req.nextUrl.pathname + req.nextUrl.search);
  const res = NextResponse.next({ request: { headers } });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
