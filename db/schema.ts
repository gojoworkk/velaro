import { pgTable, text, integer, boolean, serial, timestamp, date, index } from 'drizzle-orm/pg-core';

export const ROLES = ['owner', 'manager'] as const;
export type Role = (typeof ROLES)[number];

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

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  login: text('login').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ROLES }).notNull(),
  passwordHash: text('password_hash').notNull(),
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
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
  assignedTo: integer('assigned_to').references(() => users.id),
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

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // SHA-256 от токена из cookie
    userId: integer('user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const requestEvents = pgTable(
  'request_events',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => requests.id),
    userId: integer('user_id').notNull().references(() => users.id),
    type: text('type', { enum: ['status', 'assign', 'note'] }).notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    text: text('text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('request_events_request_idx').on(t.requestId)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('login_attempts_key_created_idx').on(t.key, t.createdAt)],
);
