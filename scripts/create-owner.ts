import { config } from 'dotenv';
config({ path: '.env.local' });

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const { getDb } = await import('@/lib/db');
const { createOwner } = await import('@/lib/admin/users');

// Ввод не с клавиатуры (файл или конвейер): читаем всё сразу и раздаём по строке на вопрос
let pipedLines: string[] | null = null;
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
    pipedLines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  }
  return pipedLines.shift() ?? '';
}

/** Обычный вопрос в терминале */
function ask(question: string): Promise<string> {
  if (!stdin.isTTY) {
    stdout.write(`${question}\n`);
    return nextPipedLine();
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Пароль: терминал переводится в «сырой» режим, символы читаются по одному
 * и никуда не выводятся — на экране не остаётся ничего, даже звёздочек
 */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) return ask(question); // ввод из файла или конвейера — экрана нет
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    let value = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          stdout.write('\n');
          process.exit(130); // Ctrl+C
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

// Для автоматических проверок можно передать значения через переменные окружения
const login = process.env.OWNER_LOGIN ?? (await ask('Логин владельца: '));
const name = process.env.OWNER_NAME ?? (await ask('Имя (как показывать в админке): '));
let password = process.env.OWNER_PASSWORD;
if (!password) {
  password = await askHidden('Пароль (не меньше 8 символов, на экране не отображается): ');
  const again = await askHidden('Повторите пароль: ');
  if (again !== password) {
    console.error('Пароли не совпадают. Запустите команду ещё раз.');
    process.exit(1);
  }
}

const res = await createOwner(getDb(), { login, name, password });
if (!res.ok) {
  console.error(Object.values(res.errors).join('\n'));
  process.exit(1);
}
console.log(`Готово: владелец «${login.trim().toLowerCase()}» создан. Вход — /admin/login`);
process.exit(0);
