import { asc } from 'drizzle-orm';
import { discountTiers } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { DEFAULT_TIERS, type Tier } from './pricing';

/** Скидки за срок из админки; если в базе их нет — значения по умолчанию */
export async function getTiers(db: AppDb): Promise<Tier[]> {
  const rows = await db
    .select({ minDays: discountTiers.minDays, percent: discountTiers.percent })
    .from(discountTiers)
    .orderBy(asc(discountTiers.position));
  return rows.length === 4 ? rows : [...DEFAULT_TIERS];
}
