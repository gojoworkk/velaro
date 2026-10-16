import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current';
import { safeNext } from '@/lib/auth/guard';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return (
    <main className="a-login">
      <div className="a-login__box">
        <p className="a-wordmark">VELARO</p>
        <h1 className="a-login__title">Вход для менеджеров</h1>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
