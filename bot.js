const { Telegraf } = require('telegraf');
const { session, Markup } = require('telegraf');

require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const users = {};
bot.use(session());

const { getWeather, getCityByCoordinates, formatCityWeatherMessage, generateWeatherShareLink } = require('./weather');
const { checkNotifications } = require('./notifications')

const KeyboardOptions = {
    TODAY: 'Дізнатись погоду',
    ADD_CITY: 'Додати місто',
    USE_LOCATION: 'Використати геолокацію',
    USE_REMIND: 'Сповіщення',
};

const NotificationKeyboardOptions = {
    SET_NOTIFICATION: 'Налаштувати щоденне сповіщення',
    REMOVE_NOTIFICATION: 'Видалити час сповіщення',
    BACK_TO_MAIN_MENU: 'Повернутись в головне меню',
};

function getMainKeyboard() {
    return Markup.keyboard([
        KeyboardOptions.TODAY, 
        KeyboardOptions.ADD_CITY, 
        KeyboardOptions.USE_LOCATION,
        KeyboardOptions.USE_REMIND,
    ]).resize();
};

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

function getCityForNotificationKeyboard(userId) {
    const cities = users[userId]?.cities || [];
    const cityButtons = cities.map((city) => [
        Markup.button.callback(city, `set_notification_${city}`)
    ]);
    return Markup.inlineKeyboard(cityButtons);
}

// Команди 
bot.command('start', (ctx) => {
    const username = ctx.message.from.first_name;
    ctx.reply(`Привіт, ${username}! Я погодний бот. Чим можу допомогти?`, getMainKeyboard());
});

bot.command('addcity', (ctx) => {
    ctx.reply('Введіть назву міста:');
    ctx.session.stage = 'add_city';
});

bot.command('setnotification', (ctx) => {
    ctx.reply('Введіть час сповіщення у форматі HH:mm (наприклад, 08:30):');
    ctx.session.stage = 'set_notification_time';
});

bot.command('about', (ctx) => {
    const aboutMessage = `
    🤖 **Про цього бота:**
    Я погодний бот, який надає актуальну інформацію про погоду в різних містах.
    Я можу допомогти дізнатись погоду на сьогодні або на наступні кілька днів.

    💬 Ви можете додавати міста, використовувати свою геолокацію для визначення погоди та налаштовувати щоденні сповіщення.
    `;
    ctx.reply(aboutMessage);
});

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

bot.hears(NotificationKeyboardOptions.SET_NOTIFICATION, (ctx) => {
    const userId = ctx.message.from.id;
    if (users[userId]?.cities?.length > 0) {
        ctx.reply('Оберіть місто для налаштування сповіщення:', getCityForNotificationKeyboard(userId));
    } else {
        ctx.reply('❌ У вас ще немає міст. Спочатку додайте місто.');
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

bot.hears(NotificationKeyboardOptions.BACK_TO_MAIN_MENU, (ctx) => {
    ctx.reply('Ви повернулись в головне меню.', getMainKeyboard());  
});

bot.hears(KeyboardOptions.USE_REMIND, (ctx) => {
    ctx.reply('Меню налаштування сповіщень:', getNotificationKeyboard());
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

checkNotifications();

bot.action(/^set_notification_(.+)$/, (ctx) => {
    const city = ctx.match[1];
    const userId = ctx.from.id;

    ctx.session.selectedCityForNotification = city;
    ctx.reply(`Вибрано місто: ${city}. Тепер введіть час сповіщення у форматі HH:mm (наприклад, 08:30):`);
    ctx.session.stage = 'set_notification_time';
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
        const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');
        const shareLink = generateWeatherShareLink(city, weatherData, 'today');
        ctx.reply(`Ось ваш прогноз для міста ${city}:\n${weatherMessage}\n\nПоділіться ним за посиланням: ${shareLink}`, getCityKeyboard(userId));
    } catch (error) {
        ctx.reply('❌ Не вдалося отримати погодні дані для цього міста.');
    }
});

bot.launch()
    .then(() => console.log('Бот запущений'))
    .catch((err) => console.error('Помилка запуску:', err));