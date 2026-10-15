# Velaro: бэкенд, этап 1 (ядро) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** форма заявки на лендинге сохраняет заявку в Postgres, сервер сам пересчитывает стоимость и шлёт уведомление менеджеру в Telegram; проект на GitHub и задеплоен на Vercel.

**Architecture:** Next.js (App Router, TypeScript) поверх существующего статического лендинга: лендинг лежит в `public/` и отдаётся на `/` через rewrite. Один route handler `POST /api/requests` вызывает чистую функцию `createRequest(db, body, deps)` — в ней вся логика (ловушка, лимит, валидация, расчёт, запись, уведомление). База — стандартный Postgres через Drizzle (`pg`-драйвер), в тестах — PGlite в памяти.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Drizzle ORM + drizzle-kit, `pg`, zod 3, Vitest 3, @electric-sql/pglite, tsx, dotenv.

**Spec:** `docs/superpowers/specs/2026-10-15-backend-core-design.md`

## Global Constraints

- Лендинг (`index.html`, `styles.css`, `script.js`) переезжает в `public/` без изменений вида; меняется только отправка формы (Task 9).
- Только стандартный Postgres: никаких Neon-специфичных драйверов и функций (переезд в РФ = смена `DATABASE_URL`).
- Скидки: 1–2 суток 0%, 3–6 — 10%, 7–13 — 20%, от 14 — 30%. Цена за сутки = `Math.round(price * (1 - rate) / 100) * 100`. Сутки = разница дат, минимум 1.
- Лимит: больше 5 заявок с одного IP за 10 минут → 429. IP хранится только как SHA-256 с солью `IP_HASH_SALT`.
- Секреты только в переменных окружения: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `IP_HASH_SALT`. `.env.local` не коммитится.
- Телефон для связи в сообщениях об ошибке: `+7 495 000-00-00`.
- Все тексты для пользователя — на русском.
- Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Файлы

| Файл | Ответственность |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `drizzle.config.ts` | сборка, тесты, миграции |
| `public/index.html`, `public/styles.css`, `public/script.js` | лендинг (перенесён) |
| `app/api/requests/route.ts` | HTTP-обёртка над `createRequest` |
| `lib/pricing.ts` | сутки, скидка, цена за сутки, итог |
| `lib/validation.ts` | телефон, «сегодня по Москве», проверка тела заявки |
| `lib/rate-limit.ts` | хеш IP, проверка и учёт лимита |
| `lib/telegram.ts` | текст уведомления, отправка в Bot API |
| `lib/create-request.ts` | сценарий приёма заявки целиком |
| `lib/db.ts` | ленивое подключение к Postgres, подмена в тестах |
| `db/schema.ts` | таблицы `cars`, `requests`, `rate_limits` |
| `db/types.ts` | тип `AppDb`, общий для `pg` и PGlite |
| `db/cars-data.ts`, `db/seed.ts` | данные 9 машин и их upsert |
| `drizzle/` | сгенерированные SQL-миграции |
| `scripts/db-seed.ts`, `scripts/telegram-chat-id.ts` | CLI: сид и поиск ID чата |
| `tests/helpers/test-db.ts` | PGlite + миграции + сид |
| `.env.example` | перечень переменных без значений |

---

### Task 1: Next.js-проект с лендингом внутри

**Files:**
- Move: `index.html` → `public/index.html`, `styles.css` → `public/styles.css`, `script.js` → `public/script.js`
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `tests/next-config.test.ts`
- Modify: `.claude/launch.json`

**Interfaces:**
- Produces: alias `@/` → корень проекта (в `tsconfig.json` и `vitest.config.ts`); скрипты `npm run dev | build | test`.

- [ ] **Step 1: Перенести лендинг**

```bash
mkdir -p public && git mv index.html public/index.html && git mv styles.css public/styles.css && git mv script.js public/script.js
```

- [ ] **Step 2: Создать `package.json`**

```json
{
  "name": "velaro",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx scripts/db-seed.ts",
    "tg:chat-id": "tsx scripts/telegram-chat-id.ts"
  }
}
```

- [ ] **Step 3: Установить зависимости**

```bash
npm install next@15 react@19 react-dom@19 drizzle-orm pg zod@3
npm install -D typescript@5 @types/node @types/react @types/pg drizzle-kit vitest@3 @electric-sql/pglite tsx dotenv
```

- [ ] **Step 4: Создать `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "public"]
}
```

- [ ] **Step 5: Создать `next.config.ts`**

```ts
import type { NextConfig } from 'next';

// Главная страница — статический лендинг из public/index.html
const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
```

- [ ] **Step 6: Создать `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 7: Написать тест на rewrite главной**

`tests/next-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';

describe('next.config', () => {
  it('отдаёт лендинг на главной', async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toMatchObject({ beforeFiles: [{ source: '/', destination: '/index.html' }] });
  });
});
```

- [ ] **Step 8: Прогнать тест**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 9: Создать `.env.example` и обновить `.claude/launch.json`**

`.env.example`:

```
# Строка подключения к Postgres (Vercel → Storage → Neon → .env.local)
DATABASE_URL=
# Токен бота от @BotFather
TELEGRAM_BOT_TOKEN=
# ID чата менеджера: npm run tg:chat-id
TELEGRAM_CHAT_ID=
# Любая длинная случайная строка
IP_HASH_SALT=
```

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "landing", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

- [ ] **Step 10: Проверить, что лендинг открывается через Next**

Run: `npm run dev`, открыть `http://localhost:3000/`.
Expected: лендинг выглядит как раньше (витрина, каталог, цены), ошибок в консоли нет.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Next.js-проект: лендинг в public/, Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Расчёт стоимости

**Files:**
- Create: `lib/pricing.ts`
- Test: `tests/pricing.test.ts`

**Interfaces:**
- Produces: `countDays(from: string, to: string): number`, `discountFor(days: number): number`, `dayRate(pricePerDay: number, days: number): number`, `quote(pricePerDay: number, from: string, to: string): { days: number; dayRate: number; total: number }`. Даты — строки `YYYY-MM-DD`.

- [ ] **Step 1: Написать тесты**

```ts
import { describe, it, expect } from 'vitest';
import { countDays, discountFor, dayRate, quote } from '@/lib/pricing';

describe('countDays', () => {
  it('в один день — 1 сутки', () => expect(countDays('2026-10-20', '2026-10-20')).toBe(1));
  it('разница дат', () => expect(countDays('2026-10-20', '2026-10-27')).toBe(7));
  it('через границу месяцев', () => expect(countDays('2026-10-30', '2026-11-02')).toBe(3));
});

describe('discountFor', () => {
  it.each([[1, 0], [2, 0], [3, 0.1], [6, 0.1], [7, 0.2], [13, 0.2], [14, 0.3], [40, 0.3]])(
    '%i суток → %f', (days, rate) => expect(discountFor(days)).toBe(rate),
  );
});

describe('dayRate', () => {
  it('без скидки', () => expect(dayRate(95000, 2)).toBe(95000));
  it('округляет до 100 ₽', () => expect(dayRate(65000, 3)).toBe(58500));
  it('−20% на 7 суток', () => expect(dayRate(150000, 7)).toBe(120000));
});

describe('quote', () => {
  it('итог = цена за сутки × сутки', () =>
    expect(quote(150000, '2026-10-20', '2026-10-27')).toEqual({ days: 7, dayRate: 120000, total: 840000 }));
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run tests/pricing.test.ts`
Expected: FAIL — модуль `@/lib/pricing` не найден.

- [ ] **Step 3: Реализовать `lib/pricing.ts`**

```ts
// Скидки за срок — те же, что на лендинге
const TIERS = [
  { minDays: 1, rate: 0 },
  { minDays: 3, rate: 0.1 },
  { minDays: 7, rate: 0.2 },
  { minDays: 14, rate: 0.3 },
] as const;

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Сутки аренды: разница дат, в один день — 1 сутки */
export function countDays(from: string, to: string): number {
  return Math.max(1, Math.round((toUtc(to) - toUtc(from)) / DAY_MS));
}

export function discountFor(days: number): number {
  let rate = 0;
  for (const tier of TIERS) if (days >= tier.minDays) rate = tier.rate;
  return rate;
}

/** Цена за сутки со скидкой, округлённая до 100 ₽ */
export function dayRate(pricePerDay: number, days: number): number {
  return Math.round((pricePerDay * (1 - discountFor(days))) / 100) * 100;
}

export function quote(pricePerDay: number, from: string, to: string) {
  const days = countDays(from, to);
  const rate = dayRate(pricePerDay, days);
  return { days, dayRate: rate, total: rate * days };
}
```

- [ ] **Step 4: Прогнать**

Run: `npx vitest run tests/pricing.test.ts`
Expected: PASS (все).

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts tests/pricing.test.ts
git commit -m "Расчёт стоимости аренды на сервере

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Проверка полей заявки

**Files:**
- Create: `lib/validation.ts`
- Test: `tests/validation.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(raw: string): string | null` → `+7XXXXXXXXXX`
  - `todayMoscow(now: Date): string` → `YYYY-MM-DD` по UTC+3
  - `type RequestInput = { name: string; phone: string; carId: string; dateFrom: string; dateTo: string; delivery: 'delivery' | 'pickup'; address: string | null; comment: string | null }`
  - `validateRequest(body: unknown, now: Date): { ok: true; data: RequestInput } | { ok: false; errors: Record<string, string> }` — ключи ошибок: `name`, `phone`, `carId`, `dateFrom`, `dateTo`, `delivery`, `address`, `comment`.

- [ ] **Step 1: Написать тесты**

```ts
import { describe, it, expect } from 'vitest';
import { normalizePhone, todayMoscow, validateRequest } from '@/lib/validation';

const NOW = new Date('2026-10-15T12:00:00Z');
const valid = {
  name: 'Анна', phone: '+7 (999) 123-45-67', carId: 'huracan',
  dateFrom: '2026-10-20', dateTo: '2026-10-27', delivery: 'delivery', address: 'Тверская, 1', comment: '',
};

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '+79991234567'],
    ['89991234567', '+79991234567'],
    ['9991234567', '+79991234567'],
  ])('%s → %s', (raw, out) => expect(normalizePhone(raw)).toBe(out));
  it('короткий номер — null', () => expect(normalizePhone('+7 999 12')).toBeNull());
});

describe('todayMoscow', () => {
  it('в 22:00 UTC в Москве уже завтра', () => expect(todayMoscow(new Date('2026-10-15T22:00:00Z'))).toBe('2026-10-16'));
});

describe('validateRequest', () => {
  it('валидная заявка: телефон нормализован, пустой комментарий → null', () => {
    const r = validateRequest(valid, NOW);
    expect(r).toEqual({ ok: true, data: { ...valid, phone: '+79991234567', comment: null } });
  });
  it('самовывоз без адреса — ок, адрес null', () => {
    const r = validateRequest({ ...valid, delivery: 'pickup', address: '' }, NOW);
    expect(r.ok && r.data.address).toBeNull();
  });
  it.each([
    ['name', { name: '  ' }],
    ['phone', { phone: '123' }],
    ['carId', { carId: '' }],
    ['dateFrom', { dateFrom: '2026-10-14' }],
    ['dateFrom', { dateFrom: 'завтра' }],
    ['dateTo', { dateTo: '2026-10-19' }],
    ['delivery', { delivery: 'teleport' }],
    ['address', { address: '' }],
    ['comment', { comment: 'x'.repeat(1001) }],
  ])('ошибка в поле %s', (field, patch) => {
    const r = validateRequest({ ...valid, ...patch }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });
  it('не объект — ошибки по полям', () => expect(validateRequest(null, NOW).ok).toBe(false));
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run tests/validation.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `lib/validation.ts`**

```ts
import { z } from 'zod';

export type RequestInput = {
  name: string;
  phone: string;
  carId: string;
  dateFrom: string;
  dateTo: string;
  delivery: 'delivery' | 'pickup';
  address: string | null;
  comment: string | null;
};

export type ValidationResult =
  | { ok: true; data: RequestInput }
  | { ok: false; errors: Record<string, string> };

/** Любой формат номера → +7XXXXXXXXXX или null */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits.length === 11 && digits.startsWith('7') ? `+${digits}` : null;
}

/** Сегодняшняя дата в Москве (UTC+3, без перехода на летнее время) */
export function todayMoscow(now: Date): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

// Не строка → пустая строка, чтобы ошибки были по-русски, а не про типы
const text = () => z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string());
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const schema = z.object({
  name: text().pipe(z.string().min(1, 'Укажите имя, чтобы мы знали, как к вам обращаться.').max(100, 'Имя слишком длинное — до 100 символов.')),
  phone: text(),
  carId: text().pipe(z.string().min(1, 'Выберите автомобиль из списка.')),
  dateFrom: text().refine(isIsoDate, 'Укажите дату получения.'),
  dateTo: text().refine(isIsoDate, 'Укажите дату возврата.'),
  delivery: text().pipe(z.enum(['delivery', 'pickup'], { errorMap: () => ({ message: 'Выберите способ получения.' }) })),
  address: text().pipe(z.string().max(300, 'Адрес слишком длинный — до 300 символов.')),
  comment: text().pipe(z.string().max(1000, 'Комментарий слишком длинный — до 1000 символов.')),
});

export function validateRequest(body: unknown, now: Date): ValidationResult {
  const parsed = schema.safeParse(typeof body === 'object' && body !== null ? body : {});
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      errors[field] ??= issue.message;
    }
  }
  const raw = parsed.success ? parsed.data : null;

  const phone = normalizePhone(typeof (body as { phone?: unknown })?.phone === 'string' ? (body as { phone: string }).phone : '');
  if (!phone) errors.phone ??= 'Укажите телефон полностью: +7 и ещё 10 цифр.';

  if (raw) {
    if (raw.dateFrom < todayMoscow(now)) errors.dateFrom ??= 'Дата получения не может быть в прошлом.';
    if (raw.dateTo < raw.dateFrom) errors.dateTo ??= 'Дата возврата должна быть не раньше даты получения.';
    if (raw.delivery === 'delivery' && !raw.address) errors.address ??= 'Укажите адрес, куда привезти автомобиль.';
  }

  if (Object.keys(errors).length || !raw || !phone) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name: raw.name,
      phone,
      carId: raw.carId,
      dateFrom: raw.dateFrom,
      dateTo: raw.dateTo,
      delivery: raw.delivery,
      address: raw.delivery === 'delivery' ? raw.address : null,
      comment: raw.comment || null,
    },
  };
}
```

- [ ] **Step 4: Прогнать**

Run: `npx vitest run tests/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/validation.test.ts
git commit -m "Серверная проверка полей заявки

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Схема базы, миграция, сид машин, тестовая база

**Files:**
- Create: `db/schema.ts`, `db/types.ts`, `db/cars-data.ts`, `db/seed.ts`, `drizzle.config.ts`, `drizzle/*` (генерируется), `tests/helpers/test-db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces:
  - таблицы `cars`, `requests`, `rateLimits` (экспорт из `@/db/schema`)
  - `type AppDb` из `@/db/types`
  - `seedCars(db: AppDb): Promise<void>` — upsert 9 машин
  - `createTestDb(): Promise<AppDb>` из `tests/helpers/test-db.ts` — PGlite + миграции + сид

- [ ] **Step 1: Создать `db/schema.ts`**

```ts
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
```

- [ ] **Step 2: Создать `db/types.ts`**

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/** Общий тип базы: подходит и для pg (прод), и для PGlite (тесты) */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
```

- [ ] **Step 3: Создать `db/cars-data.ts`** (значения 1:1 из `CARS` в `public/script.js`)

```ts
export const CAR_SEED = [
  { id: 'gt3rs', name: 'Porsche 911 GT3 RS', category: 'sport', powerHp: 500, accel0100: '3,3', seats: 2, pricePerDay: 95000, deposit: 300000 },
  { id: 'ferrari-roma', name: 'Ferrari Roma', category: 'sport', powerHp: 620, accel0100: '3,4', seats: 4, pricePerDay: 120000, deposit: 300000 },
  { id: 'huracan', name: 'Lamborghini Huracán EVO', category: 'sport', powerHp: 640, accel0100: '2,9', seats: 2, pricePerDay: 150000, deposit: 300000 },
  { id: 'g63', name: 'Mercedes-AMG G 63', category: 'suv', powerHp: 585, accel0100: '4,5', seats: 5, pricePerDay: 65000, deposit: 150000 },
  { id: 'urus', name: 'Lamborghini Urus', category: 'suv', powerHp: 650, accel0100: '3,6', seats: 5, pricePerDay: 110000, deposit: 300000 },
  { id: 'range-rover', name: 'Range Rover', category: 'suv', powerHp: 530, accel0100: '4,6', seats: 5, pricePerDay: 45000, deposit: 100000 },
  { id: 's63', name: 'Mercedes-AMG S 63', category: 'business', powerHp: 612, accel0100: '3,5', seats: 5, pricePerDay: 50000, deposit: 100000 },
  { id: 'm5', name: 'BMW M5 Competition', category: 'business', powerHp: 625, accel0100: '3,3', seats: 5, pricePerDay: 40000, deposit: 100000 },
  { id: 'bentley', name: 'Bentley Continental GT', category: 'business', powerHp: 550, accel0100: '4,0', seats: 4, pricePerDay: 85000, deposit: 200000 },
] as const;
```

- [ ] **Step 4: Создать `db/seed.ts`**

```ts
import { sql } from 'drizzle-orm';
import { cars } from './schema';
import { CAR_SEED } from './cars-data';
import type { AppDb } from './types';

/** Добавляет или обновляет 9 машин каталога; повторный запуск безопасен */
export async function seedCars(db: AppDb): Promise<void> {
  const rows = CAR_SEED.map((car, i) => ({ ...car, sortOrder: i }));
  await db
    .insert(cars)
    .values(rows)
    .onConflictDoUpdate({
      target: cars.id,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        powerHp: sql`excluded.power_hp`,
        accel0100: sql`excluded.accel_0_100`,
        seats: sql`excluded.seats`,
        pricePerDay: sql`excluded.price_per_day`,
        deposit: sql`excluded.deposit`,
        sortOrder: sql`excluded.sort_order`,
      },
    });
}
```

- [ ] **Step 5: Создать `drizzle.config.ts` и сгенерировать миграцию**

```ts
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
```

Run: `npm run db:generate`
Expected: в `drizzle/` появились `0000_*.sql` и `meta/`.

- [ ] **Step 6: Создать `tests/helpers/test-db.ts`**

```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';
import { seedCars } from '@/db/seed';
import type { AppDb } from '@/db/types';

/** Настоящий Postgres в памяти: те же миграции, что в проде, и 9 машин */
export async function createTestDb(): Promise<AppDb> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await seedCars(db as unknown as AppDb);
  return db as unknown as AppDb;
}
```

- [ ] **Step 7: Написать тест**

`tests/db.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { cars } from '@/db/schema';
import { seedCars } from '@/db/seed';
import { createTestDb } from './helpers/test-db';

describe('база', () => {
  it('миграции применяются, сид заливает 9 машин', async () => {
    const db = await createTestDb();
    expect(await db.select().from(cars)).toHaveLength(9);
  });
  it('повторный сид обновляет, а не дублирует', async () => {
    const db = await createTestDb();
    await db.update(cars).set({ pricePerDay: 1 }).where(eq(cars.id, 'gt3rs'));
    await seedCars(db);
    const [gt3] = await db.select().from(cars).where(eq(cars.id, 'gt3rs'));
    expect(gt3.pricePerDay).toBe(95000);
    expect(await db.select().from(cars)).toHaveLength(9);
  });
});
```

- [ ] **Step 8: Прогнать**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS (2).

- [ ] **Step 9: Commit**

```bash
git add db drizzle drizzle.config.ts tests/helpers tests/db.test.ts
git commit -m "Схема базы: машины, заявки, лимиты; сид каталога

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Лимит заявок по IP

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Consumes: `AppDb`, `rateLimits`, `createTestDb()`.
- Produces: `hashIp(ip: string, salt: string): string`; `checkRateLimit(db: AppDb, ipHash: string, now: Date): Promise<boolean>` — `true` если можно (и попытка учтена), `false` если лимит превышен. Константы: 5 попыток за 10 минут, записи старше суток удаляются.

- [ ] **Step 1: Написать тесты**

```ts
import { describe, it, expect } from 'vitest';
import { hashIp, checkRateLimit } from '@/lib/rate-limit';
import { rateLimits } from '@/db/schema';
import { createTestDb } from './helpers/test-db';

const at = (min: number) => new Date(Date.UTC(2026, 9, 15, 12, min));

describe('hashIp', () => {
  it('не содержит IP и зависит от соли', () => {
    const h = hashIp('1.2.3.4', 'salt');
    expect(h).not.toContain('1.2.3.4');
    expect(h).toHaveLength(64);
    expect(hashIp('1.2.3.4', 'other')).not.toBe(h);
  });
});

describe('checkRateLimit', () => {
  it('5 заявок пропускает, 6-ю за 10 минут — нет', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) expect(await checkRateLimit(db, 'ip', at(i))).toBe(true);
    expect(await checkRateLimit(db, 'ip', at(5))).toBe(false);
  });
  it('через 10 минут снова можно', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await checkRateLimit(db, 'ip', at(0));
    expect(await checkRateLimit(db, 'ip', at(11))).toBe(true);
  });
  it('другой IP не задевает', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await checkRateLimit(db, 'a', at(0));
    expect(await checkRateLimit(db, 'b', at(1))).toBe(true);
  });
  it('удаляет записи старше суток', async () => {
    const db = await createTestDb();
    await checkRateLimit(db, 'old', new Date(Date.UTC(2026, 9, 13)));
    await checkRateLimit(db, 'new', at(0));
    expect((await db.select().from(rateLimits)).map((r) => r.ipHash)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `lib/rate-limit.ts`**

```ts
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
```

- [ ] **Step 4: Прогнать**

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: PASS (5).

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts tests/rate-limit.test.ts
git commit -m "Лимит заявок по хешу IP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Уведомление в Telegram

**Files:**
- Create: `lib/telegram.ts`
- Test: `tests/telegram.test.ts`

**Interfaces:**
- Produces:
  - `type RequestSummary = { id: number; carName: string; dateFrom: string; dateTo: string; days: number; dayRate: number; total: number; deposit: number; name: string; phone: string; delivery: 'delivery' | 'pickup'; address: string | null; comment: string | null }`
  - `formatRequestMessage(r: RequestSummary): string` — HTML для Bot API
  - `sendTelegram(text: string, opts?: { token?: string; chatId?: string; fetchImpl?: typeof fetch }): Promise<boolean>` — по умолчанию берёт `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`; без них или при ошибке возвращает `false`, не бросает.

- [ ] **Step 1: Написать тесты**

```ts
import { describe, it, expect, vi } from 'vitest';
import { formatRequestMessage, sendTelegram, type RequestSummary } from '@/lib/telegram';

const base: RequestSummary = {
  id: 17, carName: 'Lamborghini Huracán EVO', dateFrom: '2026-10-20', dateTo: '2026-10-27',
  days: 7, dayRate: 120000, total: 840000, deposit: 300000,
  name: 'Анна', phone: '+79991234567', delivery: 'delivery', address: 'Тверская, 1', comment: null,
};
const plain = (s: string) => s.replace(/ | /g, ' ');

describe('formatRequestMessage', () => {
  it('содержит номер, машину, даты, суммы, контакты', () => {
    const t = plain(formatRequestMessage(base));
    expect(t).toContain('Новая заявка №17');
    expect(t).toContain('Lamborghini Huracán EVO · 20–27 октября (7 суток)');
    expect(t).toContain('120 000 ₽/сутки · итого 840 000 ₽ · депозит 300 000 ₽');
    expect(t).toContain('Анна, +7 999 123-45-67');
    expect(t).toContain('Доставка: Тверская, 1');
    expect(t).not.toContain('Комментарий');
  });
  it('разные месяцы и самовывоз', () => {
    const t = plain(formatRequestMessage({ ...base, dateFrom: '2026-10-30', dateTo: '2026-11-02', days: 3, delivery: 'pickup', address: null }));
    expect(t).toContain('30 октября — 2 ноября (3 суток)');
    expect(t).toContain('Самовывоз');
  });
  it('1 сутки — правильное слово', () => {
    expect(plain(formatRequestMessage({ ...base, dateTo: '2026-10-20', days: 1 }))).toContain('(1 сутки)');
  });
  it('экранирует HTML из полей клиента', () => {
    const t = formatRequestMessage({ ...base, name: '<b>x</b>', comment: 'a & b' });
    expect(t).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(t).toContain('Комментарий: a &amp; b');
  });
});

describe('sendTelegram', () => {
  it('без токена — false и без запроса', async () => {
    const fetchImpl = vi.fn();
    expect(await sendTelegram('t', { token: '', chatId: '1', fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('шлёт в Bot API и возвращает true при ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await sendTelegram('привет', { token: 'TOKEN', chatId: '42', fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
    expect(JSON.parse(init.body)).toEqual({ chat_id: '42', text: 'привет', parse_mode: 'HTML', disable_web_page_preview: true });
  });
  it('ошибка сети — false', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await sendTelegram('t', { token: 'T', chatId: '1', fetchImpl })).toBe(false);
  });
  it('ответ не ok — false', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: 400 }));
    expect(await sendTelegram('t', { token: 'T', chatId: '1', fetchImpl })).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run tests/telegram.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `lib/telegram.ts`**

```ts
export type RequestSummary = {
  id: number;
  carName: string;
  dateFrom: string;
  dateTo: string;
  days: number;
  dayRate: number;
  total: number;
  deposit: number;
  name: string;
  phone: string;
  delivery: 'delivery' | 'pickup';
  address: string | null;
  comment: string | null;
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const rub = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function daysWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? 'сутки' : 'суток';
}

function dateRange(from: string, to: string): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${fd} ${MONTHS[fm - 1]}`;
  if (fm === tm) return `${fd}–${td} ${MONTHS[tm - 1]}`;
  return `${fd} ${MONTHS[fm - 1]} — ${td} ${MONTHS[tm - 1]}`;
}

/** +79991234567 → +7 999 123-45-67 */
function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function formatRequestMessage(r: RequestSummary): string {
  const lines = [
    `🚗 <b>Новая заявка №${r.id}</b>`,
    `${escapeHtml(r.carName)} · ${dateRange(r.dateFrom, r.dateTo)} (${r.days} ${daysWord(r.days)})`,
    `${rub(r.dayRate)}/сутки · итого ${rub(r.total)} · депозит ${rub(r.deposit)}`,
    `${escapeHtml(r.name)}, ${prettyPhone(r.phone)}`,
    r.delivery === 'delivery' ? `Доставка: ${escapeHtml(r.address ?? '')}` : 'Самовывоз с Пресненской набережной',
  ];
  if (r.comment) lines.push(`Комментарий: ${escapeHtml(r.comment)}`);
  return lines.join('\n');
}

/** Отправляет сообщение менеджеру. Никогда не бросает: при любой проблеме — false */
export async function sendTelegram(
  text: string,
  opts: { token?: string; chatId?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const token = opts.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '';
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!token || !chatId) return false;
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Прогнать**

Run: `npx vitest run tests/telegram.test.ts`
Expected: PASS (8).

- [ ] **Step 5: Commit**

```bash
git add lib/telegram.ts tests/telegram.test.ts
git commit -m "Уведомление о заявке в Telegram

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Сценарий приёма заявки

**Files:**
- Create: `lib/create-request.ts`
- Test: `tests/create-request.test.ts`

**Interfaces:**
- Consumes: `validateRequest`, `quote`, `hashIp`, `checkRateLimit`, `formatRequestMessage`, таблицы `cars`, `requests`.
- Produces:
  - `type CreateDeps = { ip: string; now: Date; salt: string; notify: (text: string) => Promise<boolean> }`
  - `type CreateResult = { status: 201; id: number } | { status: 200; id: 0 } | { status: 400; errors: Record<string, string> } | { status: 429 }`
  - `createRequest(db: AppDb, body: unknown, deps: CreateDeps): Promise<CreateResult>`

- [ ] **Step 1: Написать тесты**

```ts
import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createRequest, type CreateDeps } from '@/lib/create-request';
import { cars, requests } from '@/db/schema';
import { createTestDb } from './helpers/test-db';

const body = {
  name: 'Анна', phone: '+7 999 123-45-67', carId: 'huracan',
  dateFrom: '2026-10-20', dateTo: '2026-10-27', delivery: 'delivery', address: 'Тверская, 1', comment: '',
  website: '',
};
const deps = (over: Partial<CreateDeps> = {}): CreateDeps => ({
  ip: '1.2.3.4', now: new Date('2026-10-15T12:00:00Z'), salt: 's', notify: vi.fn().mockResolvedValue(true), ...over,
});

describe('createRequest', () => {
  it('сохраняет заявку с ценой из базы и шлёт уведомление', async () => {
    const db = await createTestDb();
    const d = deps();
    const res = await createRequest(db, { ...body, total: 1 }, d);
    expect(res).toEqual({ status: 201, id: 1 });
    const [row] = await db.select().from(requests);
    expect(row).toMatchObject({ carId: 'huracan', phone: '+79991234567', days: 7, dayRate: 120000, total: 840000, deposit: 300000, status: 'new', telegramSent: true });
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('Новая заявка №1'));
  });
  it('ловушка для ботов: фиктивный успех, в базе пусто', async () => {
    const db = await createTestDb();
    const d = deps();
    expect(await createRequest(db, { ...body, website: 'http://spam' }, d)).toEqual({ status: 200, id: 0 });
    expect(await db.select().from(requests)).toHaveLength(0);
    expect(d.notify).not.toHaveBeenCalled();
  });
  it('ошибки полей — 400', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, { ...body, phone: '1' }, deps());
    expect(res.status).toBe(400);
    expect(res.status === 400 && res.errors.phone).toBeTruthy();
  });
  it('несуществующая или скрытая машина — 400 по carId', async () => {
    const db = await createTestDb();
    await db.update(cars).set({ active: false }).where(eq(cars.id, 'urus'));
    for (const carId of ['nope', 'urus']) {
      const res = await createRequest(db, { ...body, carId }, deps());
      expect(res.status === 400 && res.errors.carId).toBeTruthy();
    }
  });
  it('шестая заявка за 10 минут — 429', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 5; i++) await createRequest(db, body, deps());
    expect(await createRequest(db, body, deps())).toEqual({ status: 429 });
  });
  it('Telegram недоступен — заявка сохранена, telegramSent=false', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, body, deps({ notify: vi.fn().mockResolvedValue(false) }));
    expect(res.status).toBe(201);
    const [row] = await db.select().from(requests);
    expect(row.telegramSent).toBe(false);
  });
  it('notify бросает — заявка всё равно сохранена', async () => {
    const db = await createTestDb();
    const res = await createRequest(db, body, deps({ notify: vi.fn().mockRejectedValue(new Error('x')) }));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `npx vitest run tests/create-request.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать `lib/create-request.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { cars, requests } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { validateRequest } from './validation';
import { quote } from './pricing';
import { hashIp, checkRateLimit } from './rate-limit';
import { formatRequestMessage } from './telegram';

export type CreateDeps = {
  ip: string;
  now: Date;
  salt: string;
  notify: (text: string) => Promise<boolean>;
};

export type CreateResult =
  | { status: 201; id: number }
  | { status: 200; id: 0 }
  | { status: 400; errors: Record<string, string> }
  | { status: 429 };

export async function createRequest(db: AppDb, body: unknown, deps: CreateDeps): Promise<CreateResult> {
  // Невидимое поле заполняют только боты — делаем вид, что всё хорошо
  const honeypot = (body as { website?: unknown } | null)?.website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') return { status: 200, id: 0 };

  if (!(await checkRateLimit(db, hashIp(deps.ip, deps.salt), deps.now))) return { status: 429 };

  const v = validateRequest(body, deps.now);
  if (!v.ok) return { status: 400, errors: v.errors };
  const input = v.data;

  const [car] = await db.select().from(cars).where(and(eq(cars.id, input.carId), eq(cars.active, true)));
  if (!car) return { status: 400, errors: { carId: 'Этот автомобиль сейчас недоступен — выберите другой.' } };

  // Цена — только из базы; всё, что прислал браузер про деньги, игнорируется
  const price = quote(car.pricePerDay, input.dateFrom, input.dateTo);
  const [row] = await db
    .insert(requests)
    .values({ ...input, days: price.days, dayRate: price.dayRate, total: price.total, deposit: car.deposit })
    .returning({ id: requests.id });

  let sent = false;
  try {
    sent = await deps.notify(formatRequestMessage({ id: row.id, carName: car.name, ...input, ...price, deposit: car.deposit }));
  } catch {
    sent = false;
  }
  if (sent) await db.update(requests).set({ telegramSent: true }).where(eq(requests.id, row.id));

  return { status: 201, id: row.id };
}
```

- [ ] **Step 4: Прогнать**

Run: `npx vitest run tests/create-request.test.ts`
Expected: PASS (7).

- [ ] **Step 5: Commit**

```bash
git add lib/create-request.ts tests/create-request.test.ts
git commit -m "Сценарий приёма заявки: лимит, проверка, пересчёт, запись, уведомление

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Подключение к базе и `POST /api/requests`

**Files:**
- Create: `lib/db.ts`, `app/api/requests/route.ts`, `scripts/db-seed.ts`, `scripts/telegram-chat-id.ts`
- Test: `tests/route.test.ts`

**Interfaces:**
- Consumes: `createRequest`, `sendTelegram`, `seedCars`, `createTestDb`.
- Produces: `getDb(): AppDb` (ленивый `pg.Pool` по `DATABASE_URL`), `setDb(db: AppDb | null): void` (для тестов); HTTP `POST /api/requests` → `201 {id}` | `200 {id:0}` | `400 {errors}` | `429 {error:'rate_limited'}` | `500 {error:'server'}`.

- [ ] **Step 1: Создать `lib/db.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import type { AppDb } from '@/db/types';

let db: AppDb | null = null;

/** Одно подключение на экземпляр функции; создаётся при первом запросе */
export function getDb(): AppDb {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL не задан');
    db = drizzle(new Pool({ connectionString: url, max: 3 }), { schema }) as unknown as AppDb;
  }
  return db;
}

/** Только для тестов: подменить базу */
export function setDb(next: AppDb | null): void {
  db = next;
}
```

- [ ] **Step 2: Написать тесты маршрута**

`tests/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/requests/route';
import { setDb } from '@/lib/db';
import { createTestDb } from './helpers/test-db';

const post = (body: unknown, ip = '9.9.9.9') =>
  POST(new Request('http://localhost/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));

const valid = {
  name: 'Анна', phone: '89991234567', carId: 'g63',
  dateFrom: '2099-01-10', dateTo: '2099-01-12', delivery: 'pickup', address: '', comment: '', website: '',
};

describe('POST /api/requests', () => {
  beforeEach(async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    setDb(await createTestDb());
  });
  afterEach(() => { setDb(null); vi.unstubAllEnvs(); });

  it('201 и номер заявки', async () => {
    const res = await post(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 1 });
  });
  it('400 с ошибками по полям', async () => {
    const res = await post({ ...valid, name: '' });
    expect(res.status).toBe(400);
    expect((await res.json()).errors.name).toBeTruthy();
  });
  it('битый JSON — 400', async () => {
    expect((await post('{не json')).status).toBe(400);
  });
  it('429 после лимита', async () => {
    for (let i = 0; i < 5; i++) await post(valid);
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
  });
  it('база упала — 500', async () => {
    setDb({ select: () => { throw new Error('db down'); }, delete: () => { throw new Error('db down'); } } as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post(valid);
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 3: Убедиться, что падает**

Run: `npx vitest run tests/route.test.ts`
Expected: FAIL — `@/app/api/requests/route` не найден.

- [ ] **Step 4: Реализовать `app/api/requests/route.ts`**

```ts
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
    });
    if (result.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    if (result.status === 400) return NextResponse.json({ errors: result.errors }, { status: 400 });
    return NextResponse.json({ id: result.id }, { status: result.status });
  } catch (err) {
    console.error('POST /api/requests failed', err);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Прогнать все тесты**

Run: `npm test`
Expected: PASS (все файлы).

- [ ] **Step 6: Создать `scripts/db-seed.ts`**

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });

const { getDb } = await import('@/lib/db');
const { seedCars } = await import('@/db/seed');

await seedCars(getDb());
console.log('Готово: 9 машин в базе.');
process.exit(0);
```

- [ ] **Step 7: Создать `scripts/telegram-chat-id.ts`**

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });

// Показывает ID чатов, которые писали боту. Сам токен не печатается.
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('В .env.local нет TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}
const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = (await res.json()) as { ok: boolean; result?: { message?: { chat: { id: number; first_name?: string; title?: string } } }[] };
if (!data.ok) {
  console.error('Telegram отклонил токен — проверьте, что скопировали его целиком.');
  process.exit(1);
}
const chats = new Map<number, string>();
for (const u of data.result ?? []) if (u.message) chats.set(u.message.chat.id, u.message.chat.title ?? u.message.chat.first_name ?? '');
if (!chats.size) console.log('Сообщений нет. Напишите боту любое сообщение и запустите снова.');
for (const [id, who] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   (${who})`);
```

`tsx` понимает alias `@/` через `tsconfig.json` (paths) — отдельная настройка не нужна.

- [ ] **Step 8: Проверить сборку Next**

Run: `npm run build`
Expected: сборка успешна, в списке маршрутов есть `ƒ /api/requests`.

- [ ] **Step 9: Commit**

```bash
git add lib/db.ts app scripts tests/route.test.ts
git commit -m "POST /api/requests, подключение к базе, скрипты сида и ID чата

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Отправка формы с лендинга

**Files:**
- Modify: `public/index.html` (форма `#request-form`, блок `#form-success`), `public/styles.css` (конец файла), `public/script.js` (обработчик `submit` формы, ~строки 771–789; функция сброса `#form-reset`)

**Interfaces:**
- Consumes: `POST /api/requests` — тело `{ name, phone, carId, dateFrom, dateTo, delivery, address, comment, website }`, ответы из Task 8. Ключи ошибок сервера → поля формы: `name→#f-name`, `phone→#f-phone`, `carId→#f-car`, `dateFrom→#f-from`, `dateTo→#f-to`, `address→#f-address`, `comment→#f-comment`.

- [ ] **Step 1: Добавить в форму ловушку и строку статуса** (`public/index.html`)

Сразу после открывающего `<form class="form" id="request-form" novalidate>`:

```html
              <!-- Ловушка для ботов: людям не видна, боты заполняют -->
              <div class="hp" aria-hidden="true">
                <label>Не заполняйте это поле <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
              </div>
```

Внутри `<div class="form__submit">` после `<p class="caption">…</p>`:

```html
                <p class="form__status" id="form-status" role="alert" hidden></p>
```

В блоке успеха заменить `<h3 class="h3">Заявка отправлена.</h3>` на `<h3 class="h3" id="success-title">Заявка отправлена.</h3>`.

- [ ] **Step 2: Стили** (`public/styles.css`, в конец)

```css
/* Ловушка для ботов: за пределами экрана, недоступна с клавиатуры */
.hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.form__status { flex-basis: 100%; font-size: 15px; font-weight: 600; color: #b42318; }
.form__submit .btn[disabled] { opacity: .6; cursor: progress; }
```

- [ ] **Step 3: Заменить обработчик отправки** (`public/script.js`)

Заменить весь блок `form.addEventListener('submit', (e) => { … });` на:

```js
  const formStatus = $('#form-status');
  const submitBtn = $('button[type="submit"]', form);
  // Ключи ошибок сервера → поля формы
  const SERVER_FIELDS = { name: 'name', phone: 'phone', carId: 'car', dateFrom: 'from', dateTo: 'to', address: 'address', comment: 'comment' };
  const CALL_US = 'Позвоните нам: +7 495 000-00-00.';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $$('[aria-invalid]', form).forEach(clearError);
    formStatus.hidden = true;
    const errors = validate();
    if (errors.length) {
      errors.forEach(([input, message]) => setError(input, message));
      errors[0][0].focus();
      return;
    }

    const f = form.elements;
    const payload = {
      name: f.name.value, phone: f.phone.value, carId: f.car.value,
      dateFrom: f.from.value, dateTo: f.to.value, delivery: f.delivery.value,
      address: f.address.value, comment: f.comment.value, website: f.website.value,
    };
    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const car = byId(carSelect.value);
        $('#success-title').textContent = data.id ? `Заявка №${data.id} отправлена.` : 'Заявка отправлена.';
        $('#success-text').textContent =
          `${car.name}, ${formatRange(state.from, state.to)}. Перезвоним на ${f.phone.value} в течение 15 минут и подтвердим бронь.`;
        form.hidden = true;
        const success = $('#form-success');
        success.hidden = false;
        success.focus();
        return;
      }
      if (res.status === 400 && data.errors) {
        const fields = Object.entries(data.errors)
          .map(([key, message]) => [f[SERVER_FIELDS[key]], message])
          .filter(([input]) => input);
        fields.forEach(([input, message]) => setError(input, message));
        if (fields.length) { fields[0][0].focus(); return; }
      }
      formStatus.textContent = res.status === 429
        ? `Слишком много заявок подряд. ${CALL_US}`
        : `Не получилось отправить заявку. ${CALL_US}`;
      formStatus.hidden = false;
    } catch {
      formStatus.textContent = `Нет связи с сервером. Проверьте интернет или ${CALL_US.toLowerCase()}`;
      formStatus.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });
```

В обработчике `#form-reset` после `form.reset();` добавить:

```js
    formStatus.hidden = true;
    $('#success-title').textContent = 'Заявка отправлена.';
```

- [ ] **Step 4: Проверить без базы (ошибка сервера)**

Run: `npm run dev` без `.env.local`, заполнить форму на `http://localhost:3000/`, отправить.
Expected: под кнопкой красная строка «Не получилось отправить заявку. Позвоните нам: +7 495 000-00-00.», данные в форме не стёрлись, кнопка снова активна.

- [ ] **Step 5: Проверить ошибку поля с сервера**

В DevTools → Console: `fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)` → с базой из Task 10 ожидается `400`. Через форму: выбрать дату получения в прошлом невозможно (атрибут `min`), поэтому сценарий 400 покрыт автотестами Task 8.

- [ ] **Step 6: Commit**

```bash
git add public
git commit -m "Лендинг отправляет заявку на сервер и показывает номер

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: GitHub, Vercel, Neon, Telegram — запуск

Шаги с пометкой **[владелец]** выполняет владелец проекта в браузере; остальные — исполнитель.

**Files:**
- Create: `.env.local` (не коммитится)

- [ ] **Step 1: [владелец] Создать приватный репозиторий `velaro` на GitHub** (пустой, без README) и передать адрес `https://github.com/<логин>/velaro.git`.

- [ ] **Step 2: Отправить код на GitHub**

```bash
git remote add origin https://github.com/<логин>/velaro.git
git push -u origin main
```

Expected: Windows откроет окно Git Credential Manager → **[владелец]** входит в GitHub через браузер → push проходит.

- [ ] **Step 3: [владелец] Импортировать проект в Vercel**: vercel.com → Add New → Project → Import `velaro` → Framework: Next.js (определится сам) → Deploy. Первый деплой: лендинг открывается, `/api/requests` отвечает 500 (базы ещё нет) — это ожидаемо.

- [ ] **Step 4: [владелец] Создать базу**: проект в Vercel → Storage → Create Database → Neon → регион Frankfurt (eu-central-1) → Connect to project (все окружения). Vercel сам добавит `DATABASE_URL`.

- [ ] **Step 5: [владелец] Добавить переменные**: Settings → Environment Variables:
  - `TELEGRAM_BOT_TOKEN` — токен из @BotFather
  - `IP_HASH_SALT` — длинная случайная строка (сгенерировать: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - `TELEGRAM_CHAT_ID` — добавить после шага 7

- [ ] **Step 6: Заполнить `.env.local`**: исполнитель создаёт файл с пустыми ключами из `.env.example`; **[владелец]** вставляет `DATABASE_URL` (Storage → Neon → `.env.local` → Show secret) и `TELEGRAM_BOT_TOKEN`, `IP_HASH_SALT` — те же, что в Vercel.

- [ ] **Step 7: Узнать ID чата**

**[владелец]** пишет боту @velaro6782bot любое сообщение, затем:

Run: `npm run tg:chat-id`
Expected: `TELEGRAM_CHAT_ID=<число>   (<имя>)` → вписать в `.env.local` и в Vercel.

- [ ] **Step 8: Миграции и сид в Neon**

```bash
npm run db:migrate
npm run db:seed
```

Expected: миграция применена; «Готово: 9 машин в базе.»

- [ ] **Step 9: Локальная проверка целиком**

Run: `npm run dev`, отправить форму на `http://localhost:3000/`.
Expected: экран «Заявка №1 отправлена.», в Telegram пришло сообщение с машиной, датами, суммой и контактами.

- [ ] **Step 10: [владелец] Redeploy** в Vercel (Deployments → … → Redeploy), чтобы подхватились переменные; затем отправить форму на адресе `*.vercel.app`.
Expected: «Заявка №2 отправлена.» и сообщение в Telegram.

- [ ] **Step 11: Commit (если менялись файлы) и push**

```bash
git status
git push
```
