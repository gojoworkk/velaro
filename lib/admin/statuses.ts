export const STATUSES = ['new', 'in_progress', 'confirmed', 'completed', 'cancelled'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

/** Подписи вкладок списка — во множественном числе */
export const STATUS_TABS: Record<Status, string> = {
  new: 'Новые',
  in_progress: 'В работе',
  confirmed: 'Подтверждены',
  completed: 'Завершены',
  cancelled: 'Отменены',
};

export const isStatus = (s: unknown): s is Status => typeof s === 'string' && (STATUSES as readonly string[]).includes(s);

export type EventLike = { type: 'status' | 'assign' | 'note'; fromValue: string | null; toValue: string | null; authorName: string };

const label = (s: string | null) => (s && isStatus(s) ? STATUS_LABELS[s] : (s ?? '—'));

/** Строка истории: «Анна взял(а) в работу», «Анна: Новая → В работе» */
export function describeEvent(e: EventLike, people: Record<string, string>): string {
  if (e.type === 'status') return `${e.authorName}: ${label(e.fromValue)} → ${label(e.toValue)}`;
  if (e.type === 'note') return `${e.authorName}, заметка`;
  if (e.fromValue === null) return `${e.authorName} взял(а) в работу`;
  return `${e.authorName} передал(а) заявку: ${people[e.toValue ?? ''] ?? 'сотрудник'}`;
}
