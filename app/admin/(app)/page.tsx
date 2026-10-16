import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { cars } from '@/db/schema';
import { listRequests } from '@/lib/admin/requests';
import { isStatus, STATUSES, STATUS_LABELS, STATUS_TABS, type Status } from '@/lib/admin/statuses';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { dateRange, formatDateTime, prettyPhone, rub } from '@/lib/format';

type Search = { status?: string; q?: string; car?: string; page?: string };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const sp = await searchParams;
  const status: Status | 'all' = sp.status === 'all' || isStatus(sp.status) ? sp.status : 'new';
  const q = sp.q?.trim() ?? '';
  const car = sp.car ?? '';
  const db = getDb();
  const [list, carList] = await Promise.all([
    listRequests(db, { status, q, car, page: Number(sp.page) || 1 }),
    db.select({ id: cars.id, name: cars.name }).from(cars).orderBy(asc(cars.sortOrder)),
  ]);

  const href = (over: Partial<Record<'status' | 'q' | 'car' | 'page', string>>) => {
    const p = new URLSearchParams();
    const v = { status, q, car, page: '', ...over };
    for (const [k, val] of Object.entries(v)) if (val && !(k === 'status' && val === 'new')) p.set(k, val);
    const s = p.toString();
    return s ? `/admin?${s}` : '/admin';
  };
  const tabs: (Status | 'all')[] = [...STATUSES, 'all'];

  return (
    <>
      <h1 className="a-title">Заявки</h1>
      <div className="a-toolbar">
        <nav className="a-tabs" aria-label="Статус">
          {tabs.map((t) => (
            <Link key={t} href={href({ status: t })} aria-current={t === status ? 'page' : undefined}>
              {t === 'all' ? 'Все' : STATUS_TABS[t]} <small>{list.counts[t]}</small>
            </Link>
          ))}
        </nav>
        <form className="a-search" action="/admin" role="search">
          {status !== 'new' && <input type="hidden" name="status" value={status} />}
          <input type="search" name="q" defaultValue={q} placeholder="Имя или телефон" aria-label="Поиск по имени или телефону" />
          <select name="car" defaultValue={car} aria-label="Машина">
            <option value="">Все машины</option>
            {carList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="a-btn a-btn--primary">Найти</button>
          {(q || car) && <Link href={href({ q: '', car: '' })} className="a-btn a-btn--outline">Сбросить</Link>}
        </form>
      </div>

      {list.rows.length === 0 ? (
        <p className="a-empty">{q || car ? 'Ничего не нашлось.' : 'Здесь пока пусто.'}</p>
      ) : (
        <div className="a-list" role="table" aria-label="Заявки">
          <div className="a-row a-row--head" role="row">
            <span>№</span><span>Создана</span><span>Клиент</span><span>Машина</span><span>Даты</span><span>Сумма</span><span>Статус</span><span>Ответственный</span>
          </div>
          {list.rows.map((r) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} role="row" className={`a-row${!r.assigneeName && r.status === 'new' ? ' a-row--fresh' : ''}`}>
              <span className="a-row__num">№{r.id}</span>
              <span className="a-row__muted">{formatDateTime(r.createdAt)}</span>
              <span><b>{r.name}</b><br /><span className="a-row__muted">{prettyPhone(r.phone)}</span></span>
              <span>{r.carName}</span>
              <span>{dateRange(r.dateFrom, r.dateTo)}</span>
              <span>{rub(r.total)}</span>
              <span className="a-row__status">
                <span className={`a-badge${r.status === 'cancelled' || r.status === 'completed' ? ' a-badge--soft' : ''}`}>
                  {isStatus(r.status) ? STATUS_LABELS[r.status] : r.status}
                </span>
              </span>
              <span className="a-row__muted">{r.assigneeName ?? 'Не назначен'}</span>
            </Link>
          ))}
        </div>
      )}

      {list.pages > 1 && (
        <nav className="a-pager" aria-label="Страницы">
          {list.page > 1 && <Link className="a-btn a-btn--outline" href={href({ page: String(list.page - 1) })}>Назад</Link>}
          <span>Страница {list.page} из {list.pages}</span>
          {list.page < list.pages && <Link className="a-btn a-btn--outline" href={href({ page: String(list.page + 1) })}>Дальше</Link>}
        </nav>
      )}
    </>
  );
}
