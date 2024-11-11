const { Telegraf } = require('telegraf');
const { session, Markup } = require('telegraf');
const axios = require('axios');
const moment = require('moment');

require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

const bot = new Telegraf(BOT_TOKEN);

const users = {};
bot.use(session());

async function getCityByCoordinates(latitude, longitude) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHERMAP_API_KEY}`;
    try {
        const res = await axios.get(apiUrl);
        const city = res.data.name;
        return city;
    } catch (err) {
        throw new Error('Не вдалося визначити місто за геолокацією.');
    }
}
// Функція для отримання даних погоди
async function getWeather(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric`;
    try {
        const res = await axios.get(apiUrl);
        return res.data;
    } catch (err) {
        throw new Error(`Не вдалося отримати погоду для міста "${city}".`);
    }
}

function parseWeatherForecast(weatherData, days) {
    const forecasts = weatherData.list;
    const forecastsByDate = forecasts.reduce((acc, forecast) => {
        const date = moment.unix(forecast.dt).format('YYYY-MM-DD');  // Форматуємо дату у форматі "2024-11-10"
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(forecast);
        return acc;
    }, {});

    const forecastEntries = Object.entries(forecastsByDate);
    const selectedForecasts = days === 1 ? [forecastEntries[0]] : forecastEntries.slice(0, 7);

    return selectedForecasts.map(([date, forecasts]) => {
        const formattedDate = moment(date).format('dddd, D MMMM YYYY');  // Форматована дата, наприклад "Понеділок, 10 Листопада 2024"
        const formattedTemperatures = forecasts.map(forecast => {
            const timeOfDay = moment.unix(forecast.dt).format('HH:mm');
            const temp = formatTemperature(forecast.main.temp);
            const windSpeed = formatWindSpeed(forecast.wind.speed);
            const humidity = formatHumidity(forecast.main.humidity);

            return `⏰ *${timeOfDay}* - ${temp}, 🌬 ${windSpeed}, 💧 ${humidity}%`;
        }).join('\n');

        return `*${formattedDate}*:\n${formattedTemperatures}`;
    }).join('\n\n');
}


function formatCityWeatherMessage(city, weatherData, forecastType) {
    const forecast = forecastType === 'today' ? parseWeatherForecast(weatherData, 1) : parseWeatherForecast(weatherData, 7);
    return `🌍 *Погода в місті ${city}:*\n\n${forecast}\n\n☀️ Залишайтесь на зв'язку з нашим ботом для отримання актуальної інформації!`;
}

function formatTemperature(temperature) {
    return isNaN(temperature) ? '*' : `${temperature.toFixed(1)}°C`;
}

function formatWindSpeed(windSpeed) {
    return `${windSpeed.toFixed(1)} м/с`;
}

function formatHumidity(humidity) {
    return `${humidity.toFixed(0)}`;
}

// Кнопки для головного меню
const KeyboardOptions = {
    TODAY: 'Дізнатись погоду',
    ADD_CITY: 'Додати місто',
    USE_LOCATION: 'Використати геолокацію',
};

function getMainKeyboard() {
    return Markup.keyboard([KeyboardOptions.TODAY, KeyboardOptions.ADD_CITY, KeyboardOptions.USE_LOCATION]).resize();
}

// Клавіатура для вибору міст
function getCityKeyboard(userId) {
    const cities = users[userId]?.cities || [];
    const cityButtons = cities.map((city) => [
        Markup.button.callback(city, `city_${city}_today`),
        Markup.button.callback(`На тиждень`, `city_${city}_seven`),
        Markup.button.callback(`Видалити`, `remove_${city}`),
    ]);
    return Markup.inlineKeyboard(cityButtons);
}

// Команда /start
bot.command('start', (ctx) => {
    ctx.reply('Привіт! Я погодний бот.', getMainKeyboard());
});

// Команда /addcity
bot.command('addcity', (ctx) => {
    ctx.reply('Введіть назву міста:');
    ctx.session.stage = 'add_city';
});

// Обробка введення міста
bot.on('message', async (ctx) => {
    const userId = ctx.message.from.id;

    if (!ctx.session) {
        ctx.session = {};
    }

    if (ctx.session.stage === 'add_city') {
        const city = ctx.message.text.trim();
        try {
            await getWeather(city);
            if (!users[userId]) users[userId] = { cities: [] };
            users[userId].cities.push(city);
            ctx.reply(`Місто "${city}" додано!`, getMainKeyboard());
            ctx.session.stage = undefined;
        } catch (error) {
            ctx.reply(`Місто "${city}" не знайдено. Спробуйте ще раз.`);
        }
    }

    if (ctx.message.text === KeyboardOptions.TODAY && users[userId]?.cities.length) {
        ctx.reply('Оберіть місто:', getCityKeyboard(userId));
    }

    if (ctx.message.text === KeyboardOptions.ADD_CITY) {
        ctx.reply('Введіть назву міста:');
        ctx.session.stage = 'add_city';
    }
    if (ctx.message.text === KeyboardOptions.USE_LOCATION) {
        ctx.reply('Надішліть свою геолокацію, щоб дізнатися погоду на сьогодні.');
    }
    // Якщо користувач надіслав геолокацію
    if (ctx.message.location) {
        const { latitude, longitude } = ctx.message.location;
        try {
            const city = await getCityByCoordinates(latitude, longitude);
            const weatherData = await getWeather(city);
            const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');
            ctx.reply(weatherMessage, getMainKeyboard());
        } catch (error) {
            ctx.reply('❌ Не вдалося визначити місто за геолокацією.');
        }
    }
});

// Обробка кнопки "Прогноз на сьогодні"
bot.action(/^city_(.+)_today$/, async (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    try {
        const weatherData = await getWeather(city);
        const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');
        ctx.reply(weatherMessage, getCityKeyboard(userId));
    } catch (error) {
        ctx.reply('❌ Не вдалося отримати погодні дані для цього міста.');
    }
});

bot.action(/^city_(.+)_seven$/, async (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    try {
        const weatherData = await getWeather(city);
        const weatherMessage = formatCityWeatherMessage(city, weatherData, 'seven');
        ctx.reply(weatherMessage, getCityKeyboard(userId));
    } catch (error) {
        ctx.reply('❌ Не вдалося отримати погодні дані для цього міста.');
    }
});

bot.action(/^remove_(.+)$/, (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    if (users[userId]) {
        users[userId].cities = users[userId].cities.filter((item) => item !== city);
        ctx.reply(`🗑 Місто "${city}" видалено зі списку.`, getCityKeyboard(userId));
    } else {
        ctx.reply('❌ Щось пішло не так. Спробуйте ще раз.');
    }
});

bot.launch()
    .then(() => console.log('Бот запущений'))
    .catch((err) => console.error('Помилка запуску:', err));