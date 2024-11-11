const { Telegraf } = require('telegraf');
const { session, Markup } = require('telegraf');
const axios = require('axios');
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

const bot = new Telegraf(BOT_TOKEN);

const users = {};
bot.use(session());


async function getWeather(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric`;
    try {
        const res = await axios.get(apiUrl);
        return res.data;
    } catch (err) {
        throw new Error(`Не вдалося отримати погоду для міста "${city}".`)
    }
}

// Основні опції клавіатури
const KeyboardOptions = {
    WEATHER: 'Дізнатись погоду',
    ADD_CITY: 'Додати місто',
};

function getMainKeyboard() {
    return Markup.keyboard([KeyboardOptions.WEATHER, KeyboardOptions.ADD_CITY]).resize();
}

bot.command('start', (ctx) => {
    ctx.reply('Привіт! Я погодний бот.');
});

bot.command('addcity', (ctx) => {
    ctx.reply('Введіть назву міста:');
    ctx.session.stage = 'add_city';
})
bot.on('text', async (ctx) => {
    if (ctx.session.stage === 'add_city') {
        const city = ctx.message.text.trim();
        try {
            await getWeather(city);
            const userId = ctx.message.from.id;
            if(!users[userId]) users[userId] = {cities: [] };
            users[userId].cities.push(city);
            ctx.reply(`Місто "${city}" додано!`, getMainKeyboard());
            ctx.session.stage = undefined;
        } catch (error) {
            ctx.reply(`Місто "${city}" не знайдено. Спробуйте ще раз.`);
        }
    }
})

bot.launch()
  .then(() => console.log('Бот запущений'))
  .catch((err) => console.error('Помилка запуску:', err));