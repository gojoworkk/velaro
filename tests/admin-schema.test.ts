import { describe, it, expect } from 'vitest';
import { requestEvents, requests, sessions, users } from '@/db/schema';
import { createTestDb } from './helpers/test-db';

describe('схема админки', () => {
  it('пользователь, сессия, событие и ответственный сохраняются', async () => {
    const db = await createTestDb();
    const [u] = await db.insert(users).values({ login: 'anna', name: 'Анна', role: 'manager', passwordHash: 'x' }).returning();
    expect(u).toMatchObject({ active: true, mustChangePassword: true, lastLoginAt: null });
    const [r] = await db.insert(requests).values({
      name: 'Клиент', phone: '+79991234567', carId: 'g63', dateFrom: '2026-10-20', dateTo: '2026-10-21',
      delivery: 'pickup', days: 1, dayRate: 65000, total: 65000, deposit: 150000, assignedTo: u.id,
    }).returning();
    expect(r.assignedTo).toBe(u.id);
    await db.insert(sessions).values({ id: 'h', userId: u.id, createdAt: new Date(), expiresAt: new Date() });
    const [e] = await db.insert(requestEvents).values({ requestId: r.id, userId: u.id, type: 'note', text: 'привет', createdAt: new Date() }).returning();
    expect(e).toMatchObject({ type: 'note', text: 'привет', fromValue: null });
  });
  it('логин уникален', async () => {
    const db = await createTestDb();
    await db.insert(users).values({ login: 'anna', name: 'А', role: 'manager', passwordHash: 'x' });
    await expect(db.insert(users).values({ login: 'anna', name: 'Б', role: 'manager', passwordHash: 'y' })).rejects.toThrow();
  });
});
