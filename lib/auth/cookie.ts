// Без node-зависимостей: используется и в middleware
export const SESSION_COOKIE = 'velaro_session';

export const sessionCookieOptions = () => ({
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/admin' as const,
  maxAge: 30 * 24 * 60 * 60,
});
