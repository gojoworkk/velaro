'use client';
import { useActionState } from 'react';
import { createManagerAction } from '../../actions';

export function ManagerForm() {
  const [state, action, pending] = useActionState(createManagerAction, {});
  const err = state.errors ?? {};
  return (
    <form action={action} className="a-form">
      <div className="a-form a-form--row">
        <label className="a-field">
          <span>Имя</span>
          <input name="name" required maxLength={60} defaultValue={state.values?.name} />
          {err.name && <span className="a-field__error">{err.name}</span>}
        </label>
        <label className="a-field">
          <span>Логин</span>
          <input name="login" required autoCapitalize="none" spellCheck={false} placeholder="ivan" defaultValue={state.values?.login} />
          {err.login && <span className="a-field__error">{err.login}</span>}
        </label>
        <label className="a-field">
          <span>Временный пароль</span>
          <input name="password" required minLength={8} autoComplete="new-password" />
          {err.password && <span className="a-field__error">{err.password}</span>}
        </label>
        <button className="a-btn a-btn--primary a-btn--lg" disabled={pending}>{pending ? 'Добавляем…' : 'Добавить'}</button>
      </div>
      {err.form && <p className="a-error" role="alert">{err.form}</p>}
      {state.ok && <p className="a-ok" role="status">Менеджер добавлен. Передайте ему логин и временный пароль — при первом входе он придумает свой.</p>}
    </form>
  );
}
