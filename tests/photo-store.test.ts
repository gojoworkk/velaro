import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localPhotoStore, MAX_PHOTO_BYTES, photoError, photoName } from '@/lib/photo-store';

describe('проверка фото', () => {
  it.each([
    [null, 'Загрузите фото машины.'],
    [{ type: 'image/jpeg', size: 0 }, 'Загрузите фото машины.'],
    [{ type: 'image/gif', size: 10 }, 'Фото — JPG, PNG или WebP.'],
    [{ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }, 'Фото — не больше 8 МБ.'],
    [{ type: 'image/webp', size: 1000 }, null],
  ])('%j → %s', (file, err) => expect(photoError(file)).toBe(err));
  it('имя файла: папка cars, id машины, случайная часть, расширение по типу', () => {
    expect(photoName('audi-rs6', 'image/png')).toMatch(/^cars\/audi-rs6-[0-9a-f]{8}\.png$/);
  });
});

describe('локальное хранилище', () => {
  it('сохраняет файл и отдаёт адрес /uploads/…, удаляет только свои', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'velaro-photos-'));
    const store = localPhotoStore(root);
    const url = await store.put('cars/x-1.jpg', Buffer.from('jpg'), 'image/jpeg');
    expect(url).toBe('/uploads/cars/x-1.jpg');
    expect(await readFile(path.join(root, 'cars/x-1.jpg'), 'utf8')).toBe('jpg');
    await store.remove('https://images.unsplash.com/photo-1?w=1'); // чужое — не трогаем, без ошибки
    await store.remove(url);
    await expect(stat(path.join(root, 'cars/x-1.jpg'))).rejects.toThrow();
  });
});
