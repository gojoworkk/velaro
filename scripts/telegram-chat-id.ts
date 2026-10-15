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
