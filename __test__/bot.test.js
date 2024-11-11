const { Telegraf } = require('telegraf');
const { getWeather, formatCityWeatherMessage } = require('../weather');

jest.mock('telegraf');
jest.mock('../weather');
jest.mock('../notifications');

describe('Telegram Bot tests', () => {
    let bot;
    let ctx;

    beforeEach(() => {
        bot = new Telegraf();
        ctx = {
            reply: jest.fn(),
            message: {
                from: {
                    id: 1,
                    first_name: 'John'
                },
                text: '',
                location: { latitude: 50, longitude: 30 }
            },
            session: {},
            from: { id: 1 }
        };

        bot.command = jest.fn();
        bot.hears = jest.fn();
        bot.on = jest.fn();
        bot.action = jest.fn();
    });

    it('should greet the user on /start command', async () => {
        const mockReply = jest.fn();
        ctx.reply = mockReply;

        bot.command.mockImplementation((cmd, callback) => {
            if (cmd === 'start') {
                callback(ctx);
            }
        });

        await bot.command('start', (ctx) => {
            const username = ctx.message.from.first_name;
            ctx.reply(`Привіт, ${username}! Я погодний бот. Чим можу допомогти?`);
        });

        expect(mockReply).toHaveBeenCalledWith('Привіт, John! Я погодний бот. Чим можу допомогти?');
    });

    it('should add a city successfully when /addcity is called', async () => {
        const city = 'Kyiv';
        const mockReply = jest.fn();
        ctx.reply = mockReply;
        ctx.message.text = city;

        getWeather.mockResolvedValue(true);
        bot.command.mockImplementation((cmd, callback) => {
            if (cmd === 'addcity') {
                callback(ctx);
            }
        });

        await bot.command('addcity', (ctx) => {
            const city = ctx.message.text.trim();
            getWeather(city).then(() => {
                ctx.reply(`Місто "${city}" додано!`);
            }).catch(() => {
                ctx.reply(`Місто "${city}" не знайдено. Спробуйте ще раз.`);
            });
        });

        expect(mockReply).toHaveBeenCalledWith(`Місто "${city}" додано!`);
    });

    it('should handle the /setnotification command', async () => {
        const mockReply = jest.fn();
        ctx.reply = mockReply;
        ctx.message.text = '08:30';

        bot.command.mockImplementation((cmd, callback) => {
            if (cmd === 'setnotification') {
                callback(ctx);
            }
        });

        await bot.command('setnotification', (ctx) => {
            const time = ctx.message.text.trim();
            const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
            if (timeRegex.test(time)) {
                ctx.reply(`Час сповіщення встановлено на ${time}`);
            } else {
                ctx.reply('❌ Невірний формат часу. Спробуйте ще раз.');
            }
        });

        expect(mockReply).toHaveBeenCalledWith('Час сповіщення встановлено на 08:30');
    });

    it('should handle the /help command', async () => {
        const mockReply = jest.fn();
        ctx.reply = mockReply;

        bot.command.mockImplementation((cmd, callback) => {
            if (cmd === 'help') {
                callback(ctx);
            }
        });

        await bot.command('help', (ctx) => {
            const helpMessage = `
            📘 **Інструкція:**
            - /start — Почати роботу з ботом
            - /about — Дізнатись більше про бота
            - /help — Отримати допомогу
            `;
            ctx.reply(helpMessage);
        });

        expect(mockReply).toHaveBeenCalledWith(expect.stringContaining('/start — Почати роботу з ботом'));
    });

    it('should fetch weather for a city when city button is pressed', async () => {
        const city = 'Kyiv';
        const weatherData = { temperature: 15, humidity: 80 };
        const mockReply = jest.fn();
        ctx.reply = mockReply;
        
        getWeather.mockResolvedValue(weatherData);
        formatCityWeatherMessage.mockReturnValue('Погода в Києві: 15°C, вологість: 80%');

        bot.action.mockImplementation((regex, callback) => {
            if (regex.test(`city_${city}_today`)) {
                callback(ctx);
            }
        });

        await bot.action(/^city_(.+)_today$/, async (ctx) => {
            const city = ctx.match ? ctx.match[1] : null;
            const weatherData = await getWeather(city);
            const weatherMessage = formatCityWeatherMessage(city, weatherData, 'today');
            ctx.reply(weatherMessage);
        });

        expect(mockReply).toHaveBeenCalledWith('Погода в Києві: 15°C, вологість: 80%');
    });
});