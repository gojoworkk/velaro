import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Машины и скидки для лендинга. CDN Vercel держит ответ 15 секунд — правка из админки видна почти сразу.
// Браузер посетителя не кэширует: иначе stale-while-revalidate показывал бы ему старые цены
export async function GET() {
  try {
    return NextResponse.json(await getCatalog(getDb()), {
      headers: {
        'CDN-Cache-Control': 'max-age=15, stale-while-revalidate=60',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('GET /api/catalog failed', err);
    return NextResponse.json({ error: 'server' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
