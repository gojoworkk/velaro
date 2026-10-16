import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createRequest } from '@/lib/create-request';
import { sendTelegram } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Не удалось прочитать заявку.' } }, { status: 400 });
  }

  // Vercel кладёт реальный IP клиента первым в x-forwarded-for
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  try {
    const result = await createRequest(getDb(), body, {
      ip,
      now: new Date(),
      salt: process.env.IP_HASH_SALT ?? 'local-dev-salt',
      notify: (text) => sendTelegram(text),
      siteUrl: process.env.SITE_URL,
    });
    if (result.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    if (result.status === 400) return NextResponse.json({ errors: result.errors }, { status: 400 });
    return NextResponse.json({ id: result.id }, { status: result.status });
  } catch (err) {
    console.error('POST /api/requests failed', err);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
