import Link from 'next/link';
import { getRequest } from '@/lib/admin/requests';
import { describeEvent, isStatus, STATUSES, STATUS_LABELS } from '@/lib/admin/statuses';
import { listUsers } from '@/lib/admin/users';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { dateRange, daysWord, formatDateTime, prettyPhone, rub } from '@/lib/format';
import { ActionForm } from '../../../_components/action-form';
import { assignAction, noteAction, resendAction, statusAction, takeAction } from '../../../actions';
import { NoteForm } from './note-form';

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  const db = getDb();
  const r = await getRequest(db, id);
  if (!r) {
    return (
      <div className="a-empty">
        <h1 className="a-title">Заявка не найдена</h1>
        <Link href="/admin" className="a-btn a-btn--primary">К списку заявок</Link>
      </div>
    );
  }
  const staff = (await listUsers(db)).filter((u) => u.active && u.id !== r.assignedTo);
  const canAssign = user.role === 'owner' || r.assignedTo === user.id;
  const digits = r.phone.replace(/\D/g, '');

  return (
    <>
      <Link href="/admin" className="a-back">← Все заявки</Link>
      <div className="a-head">
        <h1 className="a-title">Заявка №{r.id}</h1>
        <span className="a-badge">{isStatus(r.status) ? STATUS_LABELS[r.status] : r.status}</span>
        <span className="a-row__muted">создана {formatDateTime(r.createdAt)}</span>
      </div>

      <div className="a-card-grid">
        <div className="a-stack">
          <section className="a-panel a-panel--dark">
            <h2>Клиент</h2>
            <p className="a-client">{r.name}</p>
            <a className="a-phone" href={`tel:+${digits}`}>{prettyPhone(r.phone)}</a>
            <div className="a-inline">
              <a className="a-btn a-btn--light" href={`tel:+${digits}`}>Позвонить</a>
              <a className="a-btn a-btn--light" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">WhatsApp</a>
              <a className="a-btn a-btn--light" href={`https://t.me/+${digits}`} target="_blank" rel="noreferrer">Telegram</a>
            </div>
          </section>

          <section className="a-panel">
            <h2>Аренда</h2>
            <dl className="a-dl">
              <dt>Машина</dt><dd>{r.carName}</dd>
              <dt>Даты</dt><dd>{dateRange(r.dateFrom, r.dateTo)} · {r.days} {daysWord(r.days)}</dd>
              <dt>Цена</dt><dd>{rub(r.dayRate)} / сутки</dd>
              <dt>Итого</dt><dd>{rub(r.total)}</dd>
              <dt>Депозит</dt><dd>{rub(r.deposit)}</dd>
              <dt>Получение</dt><dd>{r.delivery === 'delivery' ? `Доставка: ${r.address ?? ''}` : 'Самовывоз с Пресненской набережной'}</dd>
              {r.comment && (<><dt>Комментарий</dt><dd className="a-pre">{r.comment}</dd></>)}
            </dl>
            {!r.telegramSent && (
              <ActionForm action={resendAction.bind(null, r.id)} className="a-inline a-resend" success="Отправлено в Telegram.">
                <span className="a-badge a-badge--warn">Не отправлено в Telegram</span>
                <button className="a-btn a-btn--outline">Отправить ещё раз</button>
              </ActionForm>
            )}
          </section>
        </div>

        <div className="a-stack">
          <section className="a-panel">
            <h2>Ответственный</h2>
            <p className="a-assignee">{r.assigneeName ?? 'Не назначен'}</p>
            {r.assignedTo === null && (
              <ActionForm action={takeAction.bind(null, r.id)}>
                <button className="a-btn a-btn--primary">Взять в работу</button>
              </ActionForm>
            )}
            {r.assignedTo !== null && canAssign && staff.length > 0 && (
              <ActionForm action={assignAction.bind(null, r.id)} className="a-inline">
                <select name="userId" aria-label="Кому передать" required defaultValue="">
                  <option value="" disabled>Кому передать</option>
                  {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button className="a-btn a-btn--outline">Передать</button>
              </ActionForm>
            )}
          </section>

          <section className="a-panel">
            <h2>Статус</h2>
            <ActionForm action={statusAction.bind(null, r.id)} className="a-inline">
              {STATUSES.map((s) => (
                <button key={s} name="status" value={s} className="a-btn a-btn--outline" aria-pressed={r.status === s}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </ActionForm>
          </section>

          <section className="a-panel">
            <h2>Заметки и история</h2>
            <NoteForm action={noteAction.bind(null, r.id)} />
            {r.events.length > 0 && (
              <ol className="a-timeline">
                {r.events.map((e) => (
                  <li key={e.id}>
                    <time dateTime={e.createdAt.toISOString()}>{formatDateTime(e.createdAt)}</time>
                    <span>{describeEvent(e, r.people)}</span>
                    {e.type === 'note' && <p className="a-note">{e.text}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
