const moment = require('moment');
const { checkNotifications } = require('../notifications');
const { getWeather, formatCityWeatherMessage } = require('../weather');
const bot = { telegram: { sendMessage: jest.fn() } };

jest.mock('../weather', () => ({
    getWeather: jest.fn(),
    formatCityWeatherMessage: jest.fn()
}));

jest.mock('moment', () => jest.fn(() => ({
    format: jest.fn().mockReturnValue('12:00')
})));

describe('checkNotifications function', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();  
    });

    it('should not send a notification if the time does not match', async () => {
        const users = {
            userId1: {
                notifications: {
                    Kyiv: '13:00' 
                }
            }
        };

        await checkNotifications.call({ users });

        expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors from getWeather gracefully', async () => {
        const users = {
            userId1: {
                notifications: {
                    Kyiv: '12:00'
                }
            }
        };

        getWeather.mockRejectedValue(new Error('API error'));

        await checkNotifications.call({ users });

        expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle the case where no weather data is returned from getWeather', async () => {
        const users = {
            userId1: {
                notifications: {
                    Kyiv: '12:00'
                }
            }
        };

        getWeather.mockResolvedValue(null);

        await checkNotifications.call({ users });

        expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should not send a notification if no notifications are set for a user', async () => {
        const users = {
            userId1: {}
        };

        await checkNotifications.call({ users });

        expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should run periodically every 60 seconds', () => {
        const setIntervalSpy = jest.spyOn(global, 'setInterval');

        const users = {
            userId1: {
                notifications: {
                    Kyiv: '12:00'
                }
            }
        };

        checkNotifications.call({ users });

        jest.advanceTimersByTime(60000);

        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        setIntervalSpy.mockRestore(); 
    });

    it('should correctly handle empty notifications for a user', async () => {
        const users = {
            userId1: {
                notifications: {}
            }
        };

        await checkNotifications.call({ users });

        expect(bot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    afterAll(() => {
        jest.useRealTimers();
    });
});