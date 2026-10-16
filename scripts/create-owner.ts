import { config } from 'dotenv';
config({ path: '.env.local' });

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const { getDb } = await import('@/lib/db');
const { createOwner } = await import('@/lib/admin/users');

/** Вопрос в терминале; hidden — ввод не отображается (для пароля) */
function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY ?? false });
    if (hidden && stdin.isTTY) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void };
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden && stdin.isTTY) stdout.write('\n');
      resolve(answer);
    });
  });
}

// Для автоматических проверок можно передать значения через переменные окружения
const login = process.env.OWNER_LOGIN ?? (await ask('Логин владельца: '));
const name = process.env.OWNER_NAME ?? (await ask('Имя (как показывать в админке): '));
let password = process.env.OWNER_PASSWORD;
if (!password) {
  password = await ask('Пароль (не меньше 8 символов): ', true);
  const again = await ask('Повторите пароль: ', true);
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
