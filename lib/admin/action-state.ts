/** Что серверная функция возвращает форме */
export type ActionState = { ok?: boolean; error?: string; errors?: Record<string, string>; values?: Record<string, string> };
