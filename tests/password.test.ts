import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('пароли', () => {
  it('формат хэша и проверка', async () => {
    const h = await hashPassword('секрет-123');
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(h).not.toContain('секрет');
    expect(await verifyPassword('секрет-123', h)).toBe(true);
    expect(await verifyPassword('секрет-124', h)).toBe(false);
  });
  it('одинаковые пароли — разные хэши (соль)', async () => {
    expect(await hashPassword('password1')).not.toBe(await hashPassword('password1'));
  });
  it('мусор вместо хэша — false, без исключения', async () => {
    expect(await verifyPassword('x', 'x')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });
});
