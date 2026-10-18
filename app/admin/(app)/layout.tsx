import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/current';
import { logoutAction } from '../actions';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="a-nav">
        <Link href="/admin" className="a-nav__brand">VELARO</Link>
        <nav className="a-nav__links" aria-label="Разделы">
          <Link href="/admin">Заявки</Link>
          <Link href="/admin/cars">Автопарк</Link>
          {user.role === 'owner' && <Link href="/admin/managers">Менеджеры</Link>}
        </nav>
        <div className="a-nav__user">
          <Link href="/admin/password" className="a-nav__name" title="Сменить пароль">{user.name}</Link>
          <form action={logoutAction}>
            <button className="a-nav__logout">Выйти</button>
          </form>
        </div>
      </header>
      <main className="a-main">{children}</main>
    </>
  );
}
