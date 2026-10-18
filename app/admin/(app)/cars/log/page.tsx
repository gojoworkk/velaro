import Link from 'next/link';
import { describeChange, listPriceLog } from '@/lib/admin/fleet';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';

export default async function PriceLogPage() {
  await requireUser();
  const log = await listPriceLog(getDb());
  return (
    <>
      <Link href="/admin/cars" className="a-back">← Автопарк</Link>
      <h1 className="a-title">Журнал цен</h1>
      {log.length === 0 ? (
        <p className="a-empty">Изменений пока не было.</p>
      ) : (
        <ol className="a-log">
          {log.map((r) => (
            <li key={r.id}>
              <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
              <span className="a-log__who">{r.authorName}</span>
              <span>{describeChange(r)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="a-row__muted a-log__note">Последние 200 изменений: цены, депозиты, скидки, добавление и скрытие машин.</p>
    </>
  );
}
