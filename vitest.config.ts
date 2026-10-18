import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  // Каждый тест поднимает свою базу PGlite с миграциями; при параллельном прогоне это дольше 5 с по умолчанию
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 20_000 },
});
