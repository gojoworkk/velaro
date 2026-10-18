import { NextResponse } from 'next/server';
import { getCatalog } from '@/lib/catalog';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Машины и скидки для лендинга. CDN держит ответ 15 секунд — правка из админки видна почти сразу
export async function GET() {
  try {
    return NextResponse.json(await getCatalog(getDb()), {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('GET /api/catalog failed', err);
    return NextResponse.json({ error: 'server' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
