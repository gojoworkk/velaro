import { config } from 'dotenv';
config({ path: '.env.local' });

const { getDb } = await import('@/lib/db');
const { seedCars } = await import('@/db/seed');

await seedCars(getDb());
console.log('Готово: 9 машин в базе.');
process.exit(0);
