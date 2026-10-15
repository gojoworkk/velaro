import { NextResponse } from 'next/server';

// Проверка, что сервер жив (для мониторинга и после деплоя)
export function GET() {
  return NextResponse.json({ ok: true });
}
