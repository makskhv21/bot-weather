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
        Markup.button.callback(`Поділитись прогнозом`, `share_${city}`)
    ]);
    return Markup.inlineKeyboard(cityButtons);
}

function generateWeatherShareLink(city, weatherData, forecastType) {
    const forecast = forecastType === 'today' ? parseWeatherForecast(weatherData, 1) : parseWeatherForecast(weatherData, 7);
    const message = `🌍 *Погода в місті ${city}:*\n\n${forecast}\n\n☀️ Залишайтесь на зв'язку з нашим ботом для отримання актуальної інформації!`;
    const encodedMessage = encodeURIComponent(message);  // Кодуємо повідомлення
    const url = `https://t.me/share/url?url=${encodedMessage}`;  // Створюємо посилання для поділу
    return url;
}

// Команда /start
bot.command('start', (ctx) => {
    const username = ctx.message.from.first_name;
    ctx.reply(`Привіт, ${username}! Я погодний бот. Чим можу допомогти?`, getMainKeyboard());
});

// Команда /addcity
bot.command('addcity', (ctx) => {
    ctx.reply('Введіть назву міста:');
    ctx.session.stage = 'add_city';
});

bot.command('setnotification', (ctx) => {
    ctx.reply('Введіть час сповіщення у форматі HH:mm (наприклад, 08:30):');
    ctx.session.stage = 'set_notification_time';
});
// Команда /about
bot.command('about', (ctx) => {
    const aboutMessage = `
    🤖 **Про цього бота:**
    Я погодний бот, який надає актуальну інформацію про погоду в різних містах.
    Я можу допомогти дізнатись погоду на сьогодні або на наступні кілька днів.
    💬 Ви можете додавати міста, використовувати свою геолокацію для визначення погоди та налаштовувати щоденні сповіщення.
    `;
    ctx.reply(aboutMessage);
});
// Команда /help
bot.command('help', (ctx) => {
    const helpMessage = `
    📘 **Інструкція:**
    Ось кілька команд, які ви можете використовувати:
    - /start — Почати роботу з ботом
    - /about — Дізнатись більше про бота
    - /help — Отримати допомогу щодо використання бота
    - /addcity — Додати нове місто для прогнозу погоди
    - /setnotification — Налаштувати щоденне сповіщення для міста
    - /remove_notification — Видалити час сповіщення
    `;
    ctx.reply(helpMessage);
});
const NotificationKeyboardOptions = {
    SET_NOTIFICATION: 'Налаштувати щоденне сповіщення',
    REMOVE_NOTIFICATION: 'Видалити час сповіщення',
    BACK_TO_MAIN_MENU: 'Повернутись в головне меню',
};

function getNotificationKeyboard() {
    return Markup.keyboard([
        [
            NotificationKeyboardOptions.SET_NOTIFICATION,
            NotificationKeyboardOptions.REMOVE_NOTIFICATION
        ],
        [
            NotificationKeyboardOptions.BACK_TO_MAIN_MENU 
        ]
    ]).resize();
}

bot.hears(NotificationKeyboardOptions.BACK_TO_MAIN_MENU, (ctx) => {
    ctx.reply('Ви повернулись в головне меню.', getMainKeyboard());  
});

function getCityForNotificationKeyboard(userId) {
    const cities = users[userId]?.cities || [];
    const cityButtons = cities.map((city) => [
        Markup.button.callback(city, `set_notification_${city}`)
    ]);
    return Markup.inlineKeyboard(cityButtons);
}

// Обробка вибору міста для налаштування сповіщення
bot.hears(NotificationKeyboardOptions.SET_NOTIFICATION, (ctx) => {
    const userId = ctx.message.from.id;
    if (users[userId]?.cities?.length > 0) {
        ctx.reply('Оберіть місто для налаштування сповіщення:', getCityForNotificationKeyboard(userId));
    } else {
        ctx.reply('❌ У вас ще немає міст. Спочатку додайте місто.');
    }
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

    if (ctx.session.stage === 'set_notification_time') {
        const time = ctx.message.text.trim();

        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (timeRegex.test(time)) {
            const city = ctx.session.selectedCityForNotification;
            if (!users[userId]) users[userId] = {};

            if (!users[userId].notifications) {
                users[userId].notifications = {};
            }
            users[userId].notifications[city] = time;

            ctx.reply(`Час сповіщення для міста "${city}" встановлено на ${time}.`, getNotificationKeyboard());
            ctx.session.stage = undefined;
        } else {
            ctx.reply('❌ Невірний формат часу. Спробуйте ще раз, використовуючи формат HH:mm (наприклад, 08:30).');
        }
    }

    if (ctx.message.text === NotificationKeyboardOptions.REMOVE_NOTIFICATION) {
        if (users[userId]?.notificationTime) {
            delete users[userId].notificationTime;
            ctx.reply('Час сповіщення видалено.', getNotificationKeyboard());
        } else {
            ctx.reply('Немає налаштованого часу сповіщення.', getNotificationKeyboard());
        }
    }
});

bot.hears(NotificationKeyboardOptions.REMOVE_NOTIFICATION, (ctx) => {
    const userId = ctx.message.from.id;
    const cities = users[userId]?.cities || [];

    if (cities.length > 0) {
        ctx.reply('Оберіть місто для видалення часу сповіщення:', getCityForNotificationKeyboard(userId));
    } else {
        ctx.reply('❌ У вас ще немає міст. Спочатку додайте місто.');
    }
});

bot.action(/^remove_notification_(.+)$/, (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    if (users[userId]?.notifications && users[userId].notifications[city]) {
        delete users[userId].notifications[city];
        ctx.reply(`Час сповіщення для міста "${city}" видалено.`, getNotificationKeyboard());
    } else {
        ctx.reply('❌ Немає налаштованого часу сповіщення для цього міста.');
    }
});

function checkNotifications() {
    setInterval(() => {
        const now = moment().format('HH:mm');  
        Object.keys(users).forEach(userId => {
            const notifications = users[userId]?.notifications || {};
            Object.keys(notifications).forEach(city => {
                if (notifications[city] === now) {

                    getWeather(city).then(weatherData => {
                        const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');
                        bot.telegram.sendMessage(userId, weatherMessage);
                    });
                }
            });
        });
    }, 60000);  
}

checkNotifications();

bot.action(/^set_notification_(.+)$/, (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    ctx.session.selectedCityForNotification = city;
    ctx.reply(`Вибрано місто: ${city}. Тепер введіть час сповіщення у форматі HH:mm (наприклад, 08:30):`);
    ctx.session.stage = 'set_notification_time';
});


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

bot.action(/^share_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    try {
        const weatherData = await getWeather(city);
        const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');  // Отримуємо прогноз на сьогодні
        const shareLink = generateWeatherShareLink(city, weatherData, 'today');  // Генеруємо посилання для поділу
        ctx.reply(`Ось ваш прогноз для міста ${city}:\n${weatherMessage}\n\nПоділіться ним за посиланням: ${shareLink}`, getCityKeyboard(userId));
    } catch (error) {
        ctx.reply('❌ Не вдалося отримати погодні дані для цього міста.');
    }
});

bot.launch()
    .then(() => console.log('Бот запущений'))
    .catch((err) => console.error('Помилка запуску:', err));