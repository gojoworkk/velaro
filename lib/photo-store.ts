import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type PhotoStore = {
  put(name: string, data: Buffer, contentType: string): Promise<string>;
  /** Удалить файл, если он наш; чужие адреса (Unsplash, Gamma) игнорируются */
  remove(url: string): Promise<void>;
};

export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function photoError(file: { type: string; size: number } | null): string | null {
  if (!file || file.size === 0) return 'Загрузите фото машины.';
  if (!PHOTO_TYPES[file.type]) return 'Фото — JPG, PNG или WebP.';
  if (file.size > MAX_PHOTO_BYTES) return 'Фото — не больше 8 МБ.';
  return null;
}

export const photoName = (carId: string, type: string) =>
  `cars/${carId}-${randomBytes(4).toString('hex')}.${PHOTO_TYPES[type]}`;

/** Папка на диске — для локальной разработки, когда Blob не подключён */
export function localPhotoStore(root: string, urlPrefix = '/uploads'): PhotoStore {
  return {
    async put(name, data) {
      const file = path.join(root, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      return `${urlPrefix}/${name}`;
    },
    async remove(url) {
      if (!url.startsWith(`${urlPrefix}/cars/`)) return;
      await unlink(path.join(root, url.slice(urlPrefix.length + 1))).catch(() => {});
    },
  };
}

/** Vercel Blob — публичные картинки на CDN */
export function blobPhotoStore(token: string): PhotoStore {
  return {
    async put(name, data, contentType) {
      const { put } = await import('@vercel/blob');
      const blob = await put(name, data, { access: 'public', contentType, token });
      return blob.url;
    },
    async remove(url) {
      if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)) return;
      const { del } = await import('@vercel/blob');
      await del(url, { token }).catch(() => {});
    },
  };
}

export function getPhotoStore(): PhotoStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return blobPhotoStore(token);
  if (process.env.NODE_ENV !== 'production') return localPhotoStore(path.join(process.cwd(), 'public', 'uploads'));
  throw new Error('Хранилище фото не подключено: нет BLOB_READ_WRITE_TOKEN');
}
