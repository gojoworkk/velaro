import Link from 'next/link';
import { requireUser } from '@/lib/auth/current';
import { safeNext } from '@/lib/auth/guard';
import { PasswordForm } from './password-form';

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser(undefined, { allowMustChange: true });
  const next = safeNext((await searchParams).next);
  return (
    <main className="a-login">
      <div className="a-login__box">
        <p className="a-wordmark">VELARO</p>
        <h1 className="a-login__title">{user.mustChangePassword ? 'Придумайте свой пароль' : 'Смена пароля'}</h1>
        <p className="a-login__hint">
          {user.mustChangePassword ? 'Временный пароль больше не понадобится. ' : ''}
          Не меньше 8 символов. После смены вход на других устройствах закроется.
        </p>
        <PasswordForm next={next} />
        {!user.mustChangePassword && <Link href="/admin" className="a-login__link">Вернуться к заявкам</Link>}
      </div>
    </main>
  );
}
