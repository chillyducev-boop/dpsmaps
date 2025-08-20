import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

dotenv.config();
const TOKEN = process.env.BOT_TOKEN;
const WEB_URL = process.env.WEB_URL || 'https://dpsmap.ru';
const DB_PATH = process.env.DB_PATH || '../server/data/dpsmap.sqlite';
const ADMINS = (process.env.BOT_ADMINS || '').split(',').filter(Boolean);

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database(path.resolve(process.cwd(), DB_PATH));

function ensureUsers(){
  db.exec(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id TEXT UNIQUE, username TEXT, first_name TEXT, last_name TEXT, is_bot INTEGER DEFAULT 0,
    last_lat REAL, last_lng REAL, last_seen TEXT, cid TEXT UNIQUE, city_code TEXT
  );`);
}
ensureUsers();

function cidFor(tg_id){
  return 'tg_' + tg_id;
}

function adminBroadcast(text){
  ADMINS.forEach(id => bot.sendMessage(id, text, { disable_web_page_preview: true }));
}

bot.setMyCommands([
  { command:'/start', description:'Старт' },
  { command:'/register', description:'Регистрация' },
  { command:'/map', description:'Открыть карту' },
  { command:'/complaint', description:'Оставить жалобу' }
]);

bot.onText(/^\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Привет! Я бот DPS Map. Нажмите «Регистрация», чтобы связать аккаунт и получить CID.', {
    reply_markup: {
      keyboard: [[{text:'Регистрация'}],[{text:'Открыть карту', web_app: { url: WEB_URL }}],[{text:'Жалоба'}],[{text:'Отправить геопозицию', request_location: true}]],
      resize_keyboard: true
    }
  });
});

bot.on('message', async (msg) => {
  const text = msg.text || '';
  const chatId = msg.chat.id;

  if (text === 'Регистрация' || /^\/register/.test(text)) {
    const u = msg.from;
    const cid = cidFor(u.id);
    db.run(`INSERT INTO users(tg_id, username, first_name, last_name, is_bot, last_seen, cid)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(tg_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name, last_seen=excluded.last_seen, cid=excluded.cid`,
      [String(u.id), u.username||'', u.first_name||'', u.last_name||'', u.is_bot?1:0, new Date().toISOString(), cid],
      (err)=>{
        if (err) bot.sendMessage(chatId, 'Ошибка регистрации');
        else bot.sendMessage(chatId, `Готово! Ваш CID: \`${cid}\`\nДобавьте его в Настройках на сайте.`, { parse_mode: 'Markdown' });
      });
  } else if (text === 'Открыть карту' || /^\/map/.test(text)) {
    bot.sendMessage(chatId, 'Открываем карту…', { reply_markup: { inline_keyboard: [[{ text: 'Открыть WebApp', web_app: { url: WEB_URL } }]] } });
  } else if (text === 'Жалоба' || /^\/complaint/.test(text)) {
    bot.sendMessage(chatId, 'Напишите причину жалобы одним сообщением (можете добавить ID метки через #id).');
    bot.once('message', mm=>{
      const reason = mm.text || '(без текста)';
      db.run(`INSERT INTO complaints(author_cid, reason, created_at, status) VALUES(?,?,datetime('now'),'new')`,
        ['tg_'+mm.from.id, reason], (err)=>{
          bot.sendMessage(chatId, 'Жалоба записана. Спасибо!');
          adminBroadcast('Новая жалоба: ' + reason);
        });
    });
  }
});

bot.on('location', (msg) => {
  const u = msg.from;
  const cid = cidFor(u.id);
  const { latitude, longitude } = msg.location || {};
  db.run(`UPDATE users SET last_lat=?, last_lng=?, last_seen=datetime('now') WHERE tg_id=?`, [latitude, longitude, String(u.id)]);
  bot.sendMessage(msg.chat.id, 'Локация обновлена.');
});

// Periodic checks for spikes of "left" votes (very simple heuristic)
setInterval(()=>{
  db.all(`SELECT p.id, p.name, p.type, (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=-1 AND v.created_at >= datetime('now','-15 minutes')) AS neg15
          FROM posts p ORDER BY neg15 DESC LIMIT 5`, [], (err, rows)=>{
    rows.filter(r=>r.neg15>=2).forEach(r=>{
      adminBroadcast(`Возможное снятие метки (много "Уехали"): #${r.id} ${r.name||r.type} (-${r.neg15} за 15мин)`);
    });
  });
}, 60000);

console.log('Bot is up.');
