'use client';
import { useActionState } from 'react';
import type { Tier } from '@/lib/pricing';
import { saveTiersAction } from '../../actions';

export function TiersForm({ tiers }: { tiers: Tier[] }) {
  const [state, action, pending] = useActionState(saveTiersAction, {});
  const err = state.errors ?? {};
  const val = (key: string, fallback: number) => state.values?.[key] ?? String(fallback);
  return (
    <form action={action} className="a-form a-tiers">
      {tiers.map((t, i) => {
        const n = i + 1;
        return (
          <div key={n} className="a-tiers__row">
            <span className="a-tiers__label">Ступень {n}</span>
            <div className="a-inline">
              <span>от</span>
              {i === 0
                ? <input value="1" disabled aria-label="Первая ступень — с 1 суток" className="a-tiers__days" />
                : <input name={`minDays${n}`} defaultValue={val(`minDays${n}`, t.minDays)} inputMode="numeric" required className="a-tiers__days" aria-label={`Ступень ${n}: от скольких суток`} />}
              <span>суток —</span>
              <input name={`percent${n}`} defaultValue={val(`percent${n}`, t.percent)} inputMode="numeric" required className="a-tiers__pct" aria-label={`Ступень ${n}: скидка, %`} />
              <span>%</span>
            </div>
            {err[`tier${n}`] && <span className="a-field__error">{err[`tier${n}`]}</span>}
          </div>
        );
      })}
      {err.form && <p className="a-error" role="alert">{err.form}</p>}
      {state.ok && <p className="a-ok" role="status">Скидки сохранены. На сайте обновятся в течение 15 секунд.</p>}
      <div><button className="a-btn a-btn--primary" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить скидки'}</button></div>
    </form>
  );
}
