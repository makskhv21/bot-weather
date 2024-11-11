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

async function getWeather(city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric`;
    try {
        const res = await axios.get(apiUrl);
        return res.data;
    } catch (err) {
        throw new Error(`Не вдалося отримати погоду для міста "${city}".`);
    }
}

function parseWeatherForecast(weatherData) {
    const forecasts = weatherData.list;

    const forecastsByDate = forecasts.reduce((acc, forecast) => {
        const date = moment.unix(forecast.dt).format('DD.MM.YY');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(forecast);
        return acc;
    }, {});

    const temperaturesByDay = Object.entries(forecastsByDate).map(([date, forecasts]) => {
        const morningForecasts = forecasts.filter((forecast) => isMorning(forecast));
        const dayForecasts = forecasts.filter((forecast) => isDay(forecast));
        const eveningForecasts = forecasts.filter((forecast) => isEvening(forecast));

        const averageMorningTemperature = calculateAverageTemperature(morningForecasts);
        const averageDayTemperature = calculateAverageTemperature(dayForecasts);
        const averageEveningTemperature = calculateAverageTemperature(eveningForecasts);

        const dayOfWeek = moment(date, 'DD.MM.YY').format('dddd');

        const formattedTemperatures = [
            `Ранок: ${formatTemperature(averageMorningTemperature)}`,
            `День: ${formatTemperature(averageDayTemperature)}`,
            `Вечір: ${formatTemperature(averageEveningTemperature)}`,
        ].filter(Boolean).join(', ');

        return `${date} (${translateDayOfWeek(dayOfWeek)}): ${formattedTemperatures}`;
    });

    return temperaturesByDay.join('\n');
}

function isMorning(forecast) {
    const hour = moment.unix(forecast.dt).hour();
    return hour >= 6 && hour < 12;
}

function isDay(forecast) {
    const hour = moment.unix(forecast.dt).hour();
    return hour >= 12 && hour < 18;
}

function isEvening(forecast) {
    const hour = moment.unix(forecast.dt).hour();
    return hour >= 18 && hour < 24;
}

function calculateAverageTemperature(forecasts) {
    const temperatures = forecasts.map((forecast) => forecast.main.temp);
    return temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
}

function translateDayOfWeek(dayOfWeek) {
    const translations = {
        Monday: 'Пн',
        Tuesday: 'Вт',
        Wednesday: 'Ср',
        Thursday: 'Чт',
        Friday: 'Пт',
        Saturday: 'Сб',
        Sunday: 'Вс',
    };

    return translations[dayOfWeek] || dayOfWeek;
}

function formatTemperature(temperature) {
    return isNaN(temperature) ? '-' : `${temperature.toFixed(2)}°C`;
}

const KeyboardOptions = {
    WEATHER: 'Дізнатись погоду',
    ADD_CITY: 'Додати місто',
};

function getMainKeyboard() {
    return Markup.keyboard([KeyboardOptions.WEATHER, KeyboardOptions.ADD_CITY]).resize();
}

function getCityKeyboard(userId) {
    const cities = users[userId]?.cities || [];
    const cityButtons = cities.map((city) => [
        Markup.button.callback(city, `city_${city}`),
        Markup.button.callback(`Видалити ${city}`, `remove_${city}`),
    ]);
    return Markup.inlineKeyboard(cityButtons);
}

bot.command('start', (ctx) => {
    ctx.reply('Привіт! Я погодний бот.', getMainKeyboard());
});

bot.command('addcity', (ctx) => {
    ctx.reply('Введіть назву міста:');
    ctx.session.stage = 'add_city';
});

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

    if (ctx.message.text === KeyboardOptions.WEATHER && users[userId]?.cities.length) {
        ctx.reply('Оберіть місто:', getCityKeyboard(userId));
    }

    if (ctx.message.text === KeyboardOptions.ADD_CITY) {
        ctx.reply('Введіть назву міста:');
        ctx.session.stage = 'add_city';
    }
});

bot.action(/^city_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    try {
        const weatherData = await getWeather(city);
        const weatherMessage = `${city}:\n${parseWeatherForecast(weatherData)}`;
        ctx.reply(weatherMessage, getCityKeyboard(userId));
    } catch (error) {
        ctx.reply('Не вдалося отримати погодні дані для цього міста.');
    }
});

bot.action(/^remove_(.+)$/, (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;
    if (users[userId]) {
        users[userId].cities = users[userId].cities.filter((item) => item !== city);
        ctx.reply(`Місто "${city}" видалено зі списку.`, getCityKeyboard(userId));
    } else {
        ctx.reply('Щось пішло не так. Спробуйте ще раз.');
    }
});
bot.launch()
    .then(() => console.log('Бот запущений'))
    .catch((err) => console.error('Помилка запуску:', err));