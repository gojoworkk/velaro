import Link from 'next/link';
import { CATEGORIES, listFleet } from '@/lib/admin/fleet';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { rub } from '@/lib/format';
import { getTiers } from '@/lib/tiers';
import { ActionForm } from '../../_components/action-form';
import { moveCarAction, setCarActiveAction } from '../../actions';
import { TiersForm } from './tiers-form';

export default async function CarsPage() {
  await requireUser();
  const db = getDb();
  const [fleet, tiers] = await Promise.all([listFleet(db), getTiers(db)]);
  return (
    <>
      <div className="a-head">
        <h1 className="a-title">Автопарк</h1>
        <Link href="/admin/cars/new" className="a-btn a-btn--primary">Добавить машину</Link>
        <Link href="/admin/cars/log" className="a-btn a-btn--outline">Журнал цен</Link>
      </div>
      <ul className="a-fleet">
        {fleet.map((c, i) => (
          <li key={c.id} className={`a-fleet__item${c.active ? '' : ' a-fleet__item--off'}`}>
            <img className="a-fleet__img" src={c.photoUrl} alt="" style={{ objectPosition: c.photoPos }} />
            <div className="a-fleet__body">
              <Link href={`/admin/cars/${c.id}`} className="a-fleet__name">{c.name}</Link>
              <p className="a-row__muted">{CATEGORIES[c.category]} · {c.powerHp} л.с. · {c.accel0100} с до сотни · {c.seats} мест</p>
              <p><b>{rub(c.pricePerDay)}</b> в сутки · депозит {rub(c.deposit)}</p>
              {!c.active && <span className="a-badge a-badge--soft">Скрыта с сайта</span>}
            </div>
            <div className="a-fleet__actions">
              <ActionForm action={moveCarAction.bind(null, c.id, -1)}>
                <button className="a-btn a-btn--outline a-btn--icon" disabled={i === 0} aria-label={`Поднять ${c.name} выше`}>↑</button>
              </ActionForm>
              <ActionForm action={moveCarAction.bind(null, c.id, 1)}>
                <button className="a-btn a-btn--outline a-btn--icon" disabled={i === fleet.length - 1} aria-label={`Опустить ${c.name} ниже`}>↓</button>
              </ActionForm>
              <Link href={`/admin/cars/${c.id}`} className="a-btn a-btn--outline">Изменить</Link>
              <ActionForm action={setCarActiveAction.bind(null, c.id, !c.active)}>
                <button className={`a-btn ${c.active ? 'a-btn--danger' : 'a-btn--outline'}`}>{c.active ? 'Скрыть' : 'Показать'}</button>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
      <section className="a-section">
        <h2 className="a-subtitle">Скидки за срок</h2>
        <p className="a-row__muted a-tiers__hint">Ступень действует от указанного числа суток до следующей. Цена за сутки со скидкой округляется до 100 ₽.</p>
        <TiersForm tiers={tiers} />
      </section>
    </>
  );
}
