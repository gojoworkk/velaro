import { createHash } from 'node:crypto';
import { and, count, eq, gt, lt } from 'drizzle-orm';
import { rateLimits } from '@/db/schema';
import type { AppDb } from '@/db/types';

const WINDOW_MS = 10 * 60_000;
const MAX_IN_WINDOW = 5;
const KEEP_MS = 24 * 60 * 60_000;

/** IP не храним: только необратимый хеш с секретной солью */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** true — заявку можно принять (попытка учтена), false — лимит превышен */
export async function checkRateLimit(db: AppDb, ipHash: string, now: Date): Promise<boolean> {
  await db.delete(rateLimits).where(lt(rateLimits.createdAt, new Date(now.getTime() - KEEP_MS)));
  const [{ value }] = await db
    .select({ value: count() })
    .from(rateLimits)
    .where(and(eq(rateLimits.ipHash, ipHash), gt(rateLimits.createdAt, new Date(now.getTime() - WINDOW_MS))));
  if (value >= MAX_IN_WINDOW) return false;
  await db.insert(rateLimits).values({ ipHash, createdAt: now });
  return true;
}
