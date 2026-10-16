'use client';
import { useActionState } from 'react';
import type { ActionState } from '@/lib/admin/action-state';

export function NoteForm({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="a-form">
      <label className="a-field">
        <span>Заметка</span>
        <textarea name="text" maxLength={2000} required placeholder="Например: перезвонить в 18:00" defaultValue={state.values?.text} />
      </label>
      {state.error && <p className="a-error" role="alert">{state.error}</p>}
      <div><button className="a-btn a-btn--primary" disabled={pending}>{pending ? 'Сохраняем…' : 'Добавить заметку'}</button></div>
    </form>
  );
}
