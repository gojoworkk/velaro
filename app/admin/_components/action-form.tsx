'use client';
import { useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/admin/action-state';

/** Форма для кнопок-действий: показывает ошибку сервера или текст успеха */
export function ActionForm({
  action,
  children,
  className,
  success,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      {children}
      {state.error && <p className="a-error" role="alert">{state.error}</p>}
      {state.ok && success && <p className="a-ok" role="status">{success}</p>}
    </form>
  );
}
