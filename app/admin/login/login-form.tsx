'use client';
import { useActionState } from 'react';
import { loginAction } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="a-form">
      <input type="hidden" name="next" value={next} />
      <label className="a-field">
        <span>Логин</span>
        <input name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state.values?.login} />
      </label>
      <label className="a-field">
        <span>Пароль</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && <p className="a-error" role="alert">{state.error}</p>}
      <button className="a-btn a-btn--light a-btn--lg" disabled={pending}>{pending ? 'Входим…' : 'Войти'}</button>
    </form>
  );
}
