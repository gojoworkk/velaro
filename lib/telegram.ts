export type RequestSummary = {
  id: number;
  carName: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  dayRate: number;
  total: number;
  deposit: number;
  name: string;
  phone: string;
  delivery: 'delivery' | 'pickup';
  address: string | null;
  comment: string | null;
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const rub = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function daysWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? 'сутки' : 'суток';
}

function dateRange(from: string, to: string): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${fd} ${MONTHS[fm - 1]}`;
  if (fm === tm) return `${fd}–${td} ${MONTHS[tm - 1]}`;
  return `${fd} ${MONTHS[fm - 1]} — ${td} ${MONTHS[tm - 1]}`;
}

/** +79991234567 → +7 999 123-45-67 */
function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function formatRequestMessage(r: RequestSummary): string {
  const lines = [
    `🚗 <b>Новая заявка №${r.id}</b>`,
    `${escapeHtml(r.carName)} · ${dateRange(r.dateFrom, r.dateTo)} (${r.days} ${daysWord(r.days)})`,
    `${rub(r.dayRate)}/сутки · итого ${rub(r.total)} · депозит ${rub(r.deposit)}`,
    `${escapeHtml(r.name)}, ${prettyPhone(r.phone)}`,
    r.delivery === 'delivery' ? `Доставка: ${escapeHtml(r.address ?? '')}` : 'Самовывоз с Пресненской набережной',
  ];
  if (r.comment) lines.push(`Комментарий: ${escapeHtml(r.comment)}`);
  return lines.join('\n');
}

/** Отправляет сообщение менеджеру. Никогда не бросает: при любой проблеме — false */
export async function sendTelegram(
  text: string,
  opts: { token?: string; chatId?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const token = opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!token || !chatId) return false;
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
