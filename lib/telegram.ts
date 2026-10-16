import { dateRange, daysWord, prettyPhone, rub } from './format';

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

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Адрес карточки заявки в админке; без SITE_URL ссылки нет */
export function adminUrl(siteUrl: string | undefined, id: number): string | undefined {
  if (!siteUrl) return undefined;
  return `${siteUrl.replace(/\/+$/, '')}/admin/requests/${id}`;
}

export function formatRequestMessage(r: RequestSummary, link?: string): string {
  const lines = [
    `🚗 <b>Новая заявка №${r.id}</b>`,
    `${escapeHtml(r.carName)} · ${dateRange(r.dateFrom, r.dateTo)} (${r.days} ${daysWord(r.days)})`,
    `${rub(r.dayRate)}/сутки · итого ${rub(r.total)} · депозит ${rub(r.deposit)}`,
    `${escapeHtml(r.name)}, ${prettyPhone(r.phone)}`,
    r.delivery === 'delivery' ? `Доставка: ${escapeHtml(r.address ?? '')}` : 'Самовывоз с Пресненской набережной',
  ];
  if (r.comment) lines.push(`Комментарий: ${escapeHtml(r.comment)}`);
  if (link) lines.push(`<a href="${escapeHtml(link)}">Открыть в админке</a>`);
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
