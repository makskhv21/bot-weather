const { Telegraf } = require('telegraf');
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
bot.command('start', (ctx) => {
    ctx.reply('Привіт! Я погодний бот.');
});
bot.launch()
  .then(() => console.log('Бот запущений'))
  .catch((err) => console.error('Помилка запуску:', err));