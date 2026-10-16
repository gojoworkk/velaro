import { describe, it, expect, vi } from 'vitest';
import { adminUrl, formatRequestMessage, sendTelegram, type RequestSummary } from '@/lib/telegram';

const base: RequestSummary = {
  id: 17, carName: 'Lamborghini Huracán EVO', dateFrom: '2026-10-20', dateTo: '2026-10-27',
  days: 7, dayRate: 120000, total: 840000, deposit: 300000,
  name: 'Анна', phone: '+79991234567', delivery: 'delivery', address: 'Тверская, 1', comment: null,
};
const plain = (s: string) => s.replace(/ | /g, ' ');

describe('formatRequestMessage', () => {
  it('содержит номер, машину, даты, суммы, контакты', () => {
    const t = plain(formatRequestMessage(base));
    expect(t).toContain('Новая заявка №17');
    expect(t).toContain('Lamborghini Huracán EVO · 20–27 октября (7 суток)');
    expect(t).toContain('120 000 ₽/сутки · итого 840 000 ₽ · депозит 300 000 ₽');
    expect(t).toContain('Анна, +7 999 123-45-67');
    expect(t).toContain('Доставка: Тверская, 1');
    expect(t).not.toContain('Комментарий');
  });
  it('разные месяцы и самовывоз', () => {
    const t = plain(formatRequestMessage({ ...base, dateFrom: '2026-10-30', dateTo: '2026-11-02', days: 3, delivery: 'pickup', address: null }));
    expect(t).toContain('30 октября — 2 ноября (3 суток)');
    expect(t).toContain('Самовывоз');
  });
  it('1 сутки — правильное слово', () => {
    expect(plain(formatRequestMessage({ ...base, dateTo: '2026-10-20', days: 1 }))).toContain('(1 сутки)');
  });
  it('экранирует HTML из полей клиента', () => {
    const t = formatRequestMessage({ ...base, name: '<b>x</b>', comment: 'a & b' });
    expect(t).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(t).toContain('Комментарий: a &amp; b');
  });
});

describe('sendTelegram', () => {
  it('без токена — false и без запроса', async () => {
    const fetchImpl = vi.fn();
    expect(await sendTelegram('t', { token: '', chatId: '1', fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('шлёт в Bot API и возвращает true при ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await sendTelegram('привет', { token: 'TOKEN', chatId: '42', fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(JSON.parse(init.body)).toEqual({ chat_id: '42', text: 'привет', parse_mode: 'HTML', disable_web_page_preview: true });
  });
  it('ошибка сети — false', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await sendTelegram('t', { token: 'T', chatId: '1', fetchImpl })).toBe(false);
  });
  it('ответ не ok — false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: 400 }));
    expect(await sendTelegram('t', { token: 'T', chatId: '1', fetchImpl })).toBe(false);
  });
});

describe('ссылка на админку', () => {
  it('adminUrl убирает слэш в конце и без SITE_URL даёт undefined', () => {
    expect(adminUrl('https://velaro-three.vercel.app/', 7)).toBe('https://velaro-three.vercel.app/admin/requests/7');
    expect(adminUrl(undefined, 7)).toBeUndefined();
    expect(adminUrl('', 7)).toBeUndefined();
  });
  it('ссылка добавляется последней строкой', () => {
    const t = formatRequestMessage(base, 'https://x.ru/admin/requests/17');
    expect(t.split('\n').at(-1)).toBe('<a href="https://x.ru/admin/requests/17">Открыть в админке</a>');
  });
  it('без ссылки — как раньше', () => {
    expect(formatRequestMessage(base)).not.toContain('админке');
  });
});
