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
