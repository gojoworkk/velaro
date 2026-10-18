'use client';
import { useActionState } from 'react';
import { addBlockAction } from '../../actions';

export function BlockForm({ cars, today }: { cars: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState(addBlockAction, {});
  const err = state.errors ?? {};
  const v = (k: string) => state.values?.[k] ?? '';
  return (
    <form action={action} className="a-form">
      <div className="a-form a-blockform">
        <label className="a-field">
          <span>Машина</span>
          <select name="carId" required defaultValue={v('carId')}>
            <option value="" disabled>Выберите машину</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {err.carId && <span className="a-field__error">{err.carId}</span>}
        </label>
        <label className="a-field">
          <span>С</span>
          <input type="date" name="from" required min={today} defaultValue={v('from')} />
          {err.from && <span className="a-field__error">{err.from}</span>}
        </label>
        <label className="a-field">
          <span>По (включительно)</span>
          <input type="date" name="to" required min={today} defaultValue={v('to')} />
          {err.to && <span className="a-field__error">{err.to}</span>}
        </label>
        <label className="a-field">
          <span>Причина</span>
          <input name="reason" required maxLength={100} list="block-reasons" defaultValue={v('reason')} placeholder="ТО" />
          {err.reason && <span className="a-field__error">{err.reason}</span>}
        </label>
        <datalist id="block-reasons">
          <option value="ТО" />
          <option value="Ремонт" />
          <option value="Бронь по телефону" />
          <option value="Машина у владельца" />
        </datalist>
        <button className="a-btn a-btn--primary a-btn--lg" disabled={pending}>{pending ? 'Сохраняем…' : 'Закрыть даты'}</button>
      </div>
      {err.form && <p className="a-error" role="alert">{err.form}</p>}
      {state.ok && <p className="a-ok" role="status">Даты закрыты. На сайте обновится в течение 15 секунд.</p>}
    </form>
  );
}
