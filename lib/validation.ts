import { z } from 'zod';

export type RequestInput = {
  name: string;
  phone: string;
  carId: string;
  dateFrom: string;
  dateTo: string;
  delivery: 'delivery' | 'pickup';
  address: string | null;
  comment: string | null;
};

export type ValidationResult =
  | { ok: true; data: RequestInput }
  | { ok: false; errors: Record<string, string> };

/** Любой формат номера → +7XXXXXXXXXX или null */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length === 11 && digits.startsWith('7') ? `+${digits}` : null;
}

/** Сегодняшняя дата в Москве (UTC+3, без перехода на летнее время) */
export function todayMoscow(now: Date): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

// Не строка → пустая строка, чтобы ошибки были по-русски, а не про типы
const text = () => z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string());
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const schema = z.object({
  name: text().pipe(z.string().min(1, 'Укажите имя, чтобы мы знали, как к вам обращаться.').max(100, 'Имя слишком длинное — до 100 символов.')),
  phone: text(),
  carId: text().pipe(z.string().min(1, 'Выберите автомобиль из списка.')),
  dateFrom: text().refine(isIsoDate, 'Укажите дату получения.'),
  dateTo: text().refine(isIsoDate, 'Укажите дату возврата.'),
  delivery: text().pipe(z.enum(['delivery', 'pickup'], { errorMap: () => ({ message: 'Выберите способ получения.' }) })),
  address: text().pipe(z.string().max(300, 'Адрес слишком длинный — до 300 символов.')),
  comment: text().pipe(z.string().max(1000, 'Комментарий слишком длинный — до 1000 символов.')),
});

export function validateRequest(body: unknown, now: Date): ValidationResult {
  const parsed = schema.safeParse(typeof body === 'object' && body !== null ? body : {});
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      errors[field] ??= issue.message;
    }
  }
  const raw = parsed.success ? parsed.data : null;

  const rawPhone = (body as { phone?: unknown } | null)?.phone;
  const phone = normalizePhone(typeof rawPhone === 'string' ? rawPhone : '');
  if (!phone) errors.phone ??= 'Укажите телефон полностью: +7 и ещё 10 цифр.';

  if (raw) {
    if (raw.dateFrom < todayMoscow(now)) errors.dateFrom ??= 'Дата получения не может быть в прошлом.';
    if (raw.dateTo < raw.dateFrom) errors.dateTo ??= 'Дата возврата должна быть не раньше даты получения.';
    if (raw.delivery === 'delivery' && !raw.address) errors.address ??= 'Укажите адрес, куда привезти автомобиль.';
  }

  if (Object.keys(errors).length || !raw || !phone) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name: raw.name,
      phone,
      carId: raw.carId,
      dateFrom: raw.dateFrom,
      dateTo: raw.dateTo,
      delivery: raw.delivery,
      address: raw.delivery === 'delivery' ? raw.address : null,
      comment: raw.comment || null,
    },
  };
}
