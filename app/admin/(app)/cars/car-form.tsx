'use client';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/admin/action-state';
import { CATEGORIES, PHOTO_POSITIONS, type CarRow } from '@/lib/admin/fleet';

type Props = { action: (s: ActionState, fd: FormData) => Promise<ActionState>; car?: CarRow };

export function CarForm({ action, car }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const err = state.errors ?? {};
  const v = (key: string, fallback: string | number | undefined) =>
    state.values?.[key] ?? (fallback === undefined ? '' : String(fallback));
  const [preview, setPreview] = useState<string | null>(null);
  const [pos, setPos] = useState(car?.photoPos ?? '50% 60%');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // Своё кадрирование машины (не из списка) остаётся доступным как «Как сейчас»
  const positions = PHOTO_POSITIONS[pos] ? PHOTO_POSITIONS : { ...PHOTO_POSITIONS, [pos]: 'Как сейчас' };
  const img = preview ?? car?.photoUrl ?? null;

  const field = (name: string, label: string, input: ReactNode) => (
    <label className="a-field">
      <span>{label}</span>
      {input}
      {err[name] && <span className="a-field__error">{err[name]}</span>}
    </label>
  );

  return (
    <form action={formAction} className="a-carform">
      <div className="a-carform__photo">
        <div className="a-carform__preview">
          {img ? <img src={img} alt="" style={{ objectPosition: pos }} /> : <span>Фото появится здесь</span>}
        </div>
        {field('photo', car ? 'Новое фото (если нужно заменить)' : 'Фото машины',
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required={!car}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }} />)}
        <p className="a-row__muted a-carform__hint">JPG, PNG или WebP до 8 МБ. Лучше горизонтальный кадр, машина целиком.</p>
        {field('photoPos', 'Положение кадра',
          <select name="photoPos" value={pos} onChange={(e) => setPos(e.currentTarget.value)}>
            {Object.entries(positions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>)}
        {field('photoAlt', 'Подпись к фото (для незрячих и поисковиков)',
          <input name="photoAlt" maxLength={200} defaultValue={v('photoAlt', car?.photoAlt)} placeholder="Например: чёрный Urus на набережной" />)}
      </div>

      <div className="a-carform__fields">
        {field('name', 'Название', <input name="name" required maxLength={60} defaultValue={v('name', car?.name)} />)}
        {field('category', 'Класс',
          <select name="category" defaultValue={v('category', car?.category ?? 'sport')}>
            {Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>)}
        <div className="a-carform__row">
          {field('powerHp', 'Мощность, л.с.', <input name="powerHp" inputMode="numeric" required defaultValue={v('powerHp', car?.powerHp)} />)}
          {field('accel0100', 'Разгон до 100, с', <input name="accel0100" inputMode="decimal" required defaultValue={v('accel0100', car?.accel0100)} placeholder="3,4" />)}
          {field('seats', 'Мест', <input name="seats" inputMode="numeric" required defaultValue={v('seats', car?.seats)} />)}
        </div>
        <div className="a-carform__row">
          {field('pricePerDay', 'Цена за сутки, ₽', <input name="pricePerDay" inputMode="numeric" required defaultValue={v('pricePerDay', car?.pricePerDay)} />)}
          {field('deposit', 'Депозит, ₽', <input name="deposit" inputMode="numeric" required defaultValue={v('deposit', car?.deposit)} />)}
        </div>
        <label className="a-check">
          <input type="checkbox" name="active" defaultChecked={car ? car.active : true} />
          <span>Показывать на сайте</span>
        </label>
        {state.error && <p className="a-error" role="alert">{state.error}</p>}
        <div className="a-inline">
          <button className="a-btn a-btn--primary a-btn--lg" disabled={pending}>{pending ? 'Сохраняем…' : car ? 'Сохранить' : 'Добавить машину'}</button>
        </div>
      </div>
    </form>
  );
}
