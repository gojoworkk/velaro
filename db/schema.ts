import { pgTable, text, integer, boolean, serial, timestamp, date, index } from 'drizzle-orm/pg-core';

export const cars = pgTable('cars', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category', { enum: ['sport', 'suv', 'business'] }).notNull(),
  powerHp: integer('power_hp').notNull(),
  accel0100: text('accel_0_100').notNull(),
  seats: integer('seats').notNull(),
  pricePerDay: integer('price_per_day').notNull(),
  deposit: integer('deposit').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  carId: text('car_id').notNull().references(() => cars.id),
  dateFrom: date('date_from').notNull(),
  dateTo: date('date_to').notNull(),
  delivery: text('delivery', { enum: ['delivery', 'pickup'] }).notNull(),
  address: text('address'),
  comment: text('comment'),
  days: integer('days').notNull(),
  dayRate: integer('day_rate').notNull(),
  total: integer('total').notNull(),
  deposit: integer('deposit').notNull(),
  status: text('status').notNull().default('new'),
  telegramSent: boolean('telegram_sent').notNull().default(false),
});

export const rateLimits = pgTable(
  'rate_limits',
  {
    id: serial('id').primaryKey(),
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('rate_limits_ip_created_idx').on(t.ipHash, t.createdAt)],
);
