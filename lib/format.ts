const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const rub = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;

export function daysWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? 'сутки' : 'суток';
}

export function dateRange(from: string, to: string): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${fd} ${MONTHS[fm - 1]}`;
  if (fm === tm) return `${fd}–${td} ${MONTHS[tm - 1]}`;
  return `${fd} ${MONTHS[fm - 1]} — ${td} ${MONTHS[tm - 1]}`;
}

/** +79991234567 → +7 999 123-45-67 */
export function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

const DATE_TIME = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

/** Время по Москве: «16 окт., 14:05» */
export const formatDateTime = (d: Date) => DATE_TIME.format(d);
