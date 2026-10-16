'use client';
import { useActionState } from 'react';
import { changePasswordAction } from '../actions';

export function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  const err = state.errors ?? {};
  return (
    <form action={action} className="a-form">
      <input type="hidden" name="next" value={next} />
      <label className="a-field">
        <span>Новый пароль</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        {err.password && <span className="a-field__error">{err.password}</span>}
      </label>
      <label className="a-field">
        <span>Повторите пароль</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        {err.confirm && <span className="a-field__error">{err.confirm}</span>}
      </label>
      <button className="a-btn a-btn--light a-btn--lg" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить пароль'}</button>
    </form>
  );
}
