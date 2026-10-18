import Link from 'next/link';
import type { CSSProperties } from 'react';
import { listBlocks, monthGrid, monthTitle, parseMonth, shiftMonth } from '@/lib/admin/calendar';
import { listFleet } from '@/lib/admin/fleet';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { dateRange } from '@/lib/format';
import { todayMoscow } from '@/lib/validation';
import { ActionForm } from '../../_components/action-form';
import { removeBlockAction } from '../../actions';
import { BlockForm } from './block-form';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser();
  const today = todayMoscow(new Date());
  const month = parseMonth((await searchParams).month, today);
  const db = getDb();
  const [grid, blocks, fleet] = await Promise.all([monthGrid(db, month, today), listBlocks(db, month), listFleet(db)]);
  return (
    <>
      <div className="a-head">
        <h1 className="a-title">Календарь</h1>
        <nav className="a-cal__nav" aria-label="Месяц">
          <Link className="a-btn a-btn--outline a-btn--icon" href={`/admin/calendar?month=${shiftMonth(month, -1)}`} aria-label="Предыдущий месяц">‹</Link>
          <span className="a-cal__month">{monthTitle(month)}</span>
          <Link className="a-btn a-btn--outline a-btn--icon" href={`/admin/calendar?month=${shiftMonth(month, 1)}`} aria-label="Следующий месяц">›</Link>
          {month !== today.slice(0, 7) && <Link className="a-btn a-btn--outline" href="/admin/calendar">Сегодня</Link>}
        </nav>
      </div>

      <div className="a-cal" style={{ '--cols': grid.days.length } as CSSProperties}>
        <div className="a-cal__row a-cal__row--head">
          <span className="a-cal__car">Машина</span>
          {grid.days.map((d) => (
            <span key={d.iso} className={`a-cal__day${d.weekend ? ' is-weekend' : ''}${d.today ? ' is-today' : ''}`}>{d.day}</span>
          ))}
        </div>
        {grid.rows.map((r) => (
          <div key={r.carId} className="a-cal__row">
            <span className="a-cal__car">{r.name}{!r.active && <small> · скрыта</small>}</span>
            {grid.days.map((d) => (
              <span key={d.iso} className={`a-cal__cell${d.weekend ? ' is-weekend' : ''}${d.today ? ' is-today' : ''}`} style={{ gridColumn: d.day + 1 }} />
            ))}
            {r.bars.map((b) => {
              const style = { gridColumn: `${b.start + 1} / span ${b.span}` };
              const cls = `a-cal__bar a-cal__bar--${b.kind}${b.cutStart ? ' is-cut-start' : ''}${b.cutEnd ? ' is-cut-end' : ''}`;
              const title = `${b.label}: ${dateRange(b.from, b.to)}`;
              return b.kind === 'request'
                ? <Link key={`r${b.id}`} href={`/admin/requests/${b.id}`} className={cls} style={style} title={title}>{b.label}</Link>
                : <a key={`b${b.id}`} href={`#block-${b.id}`} className={cls} style={style} title={title}>{b.label}</a>;
            })}
          </div>
        ))}
      </div>
      <p className="a-row__muted a-cal__legend">
        <span className="a-cal__swatch a-cal__swatch--request" /> подтверждённая заявка
        <span className="a-cal__swatch a-cal__swatch--block" /> даты закрыты вручную
      </p>

      <section className="a-section">
        <h2 className="a-subtitle">Закрыть даты</h2>
        <BlockForm cars={fleet.map((c) => ({ id: c.id, name: c.name }))} today={today} />
      </section>

      {blocks.length > 0 && (
        <section className="a-section">
          <h2 className="a-subtitle">Закрытые даты в этом месяце</h2>
          <ul className="a-blocks">
            {blocks.map((b) => (
              <li key={b.id} id={`block-${b.id}`}>
                <b>{b.carName}</b>
                <span>{dateRange(b.from, b.to)}</span>
                <span>{b.reason}</span>
                <span className="a-row__muted">{b.authorName}</span>
                <ActionForm action={removeBlockAction.bind(null, b.id)}>
                  <button className="a-btn a-btn--outline">Открыть даты</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
