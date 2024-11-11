const axios = require('axios');
const moment = require('moment');
const {
    getWeather,
    getCityByCoordinates,
    formatCityWeatherMessage,
    generateWeatherShareLink
} = require('../weather');

jest.mock('axios');

describe('Weather Utility Functions', () => {
    describe('getCityByCoordinates', () => {
        it('повертає назву міста за заданими координатами', async () => {
            const mockResponse = { data: { name: 'Kyiv' } };
            axios.get.mockResolvedValue(mockResponse);

            const city = await getCityByCoordinates(50.45, 30.52);
            expect(city).toBe('Kyiv');
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('lat=50.45&lon=30.52'));
        });

        it('викидає помилку, якщо API повертає помилку', async () => {
            axios.get.mockRejectedValue(new Error('API Error'));

            await expect(getCityByCoordinates(50.45, 30.52))
                .rejects
                .toThrow('Не вдалося визначити місто за геолокацією.');
        });
    });

    describe('getWeather', () => {
        it('повертає дані про погоду для заданого міста', async () => {
            const mockResponse = { data: { city: { name: 'Kyiv' }, list: [] } };
            axios.get.mockResolvedValue(mockResponse);

            const weatherData = await getWeather('Kyiv');
            expect(weatherData).toEqual(mockResponse.data);
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('q=Kyiv'));
        });

        it('викидає помилку, якщо API повертає помилку', async () => {
            axios.get.mockRejectedValue(new Error('API Error'));

            await expect(getWeather('Kyiv'))
                .rejects
                .toThrow('Не вдалося отримати погоду для міста "Kyiv".');
        });
    });

    describe('formatCityWeatherMessage', () => {
        it('повертає форматоване повідомлення з прогнозом погоди', () => {
            const mockWeatherData = {
                list: [
                    { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
                ]
            };
            const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'today');
            expect(formattedMessage).toContain('🌍 *Погода в місті Kyiv:*');
            expect(formattedMessage).toContain('⏰');
            expect(formattedMessage).toContain('20.0°C');
        });
    });

    describe('generateWeatherShareLink', () => {
        it('генерує правильний лінк для поділу погоди', () => {
            const mockWeatherData = {
                list: [
                    {
                        dt: 1699730400, 
                        main: {
                            temp: 20.0,
                            humidity: 50,
                        },
                        wind: {
                            speed: 3.0,
                        },
                    },
                ],
            };
    
            const shareLink = generateWeatherShareLink('Kyiv', mockWeatherData, 'today');
            expect(shareLink).toContain('https://t.me/share/url?url=');
    
            const decodedLink = decodeURIComponent(shareLink);
            expect(decodedLink).toContain('🌍 *Погода в місті Kyiv:*');
        });
    });    
    it('throws error for invalid coordinates', async () => {
        axios.get.mockRejectedValue(new Error('Invalid coordinates'));
        await expect(getCityByCoordinates('invalid', 'invalid')).rejects.toThrow('Не вдалося визначити місто за геолокацією.');
    });
    
    it('formats message for daily forecast', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'today');
        expect(formattedMessage).toContain('🌍 *Погода в місті Kyiv:*');
        expect(formattedMessage).toContain('⏰');
        expect(formattedMessage).toContain('20.0°C');
    });
    
    it('formats message for weekly forecast', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'week');
        expect(formattedMessage).toContain('🌍 *Погода в місті Kyiv:*');
    });
    it('formats message for daily forecast', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'today');
        expect(formattedMessage).toContain('🌍 *Погода в місті Kyiv:*');
        expect(formattedMessage).toContain('⏰');
        expect(formattedMessage).toContain('20.0°C');
    });
    
    it('formats message for weekly forecast', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'week');
        expect(formattedMessage).toContain('🌍 *Погода в місті Kyiv:*');
    });

    it('formats temperature correctly', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 25.7, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'today');
        expect(formattedMessage).toContain('25.7°C');
    });

    it('formats wind speed correctly', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3.4 } }
            ]
        };
        const formattedMessage = formatCityWeatherMessage('Kyiv', mockWeatherData, 'today');
        expect(formattedMessage).toContain('3.4 м/с');
    });

    it('generates a correct share link with encoded weather message', () => {
        const mockWeatherData = {
            list: [
                { dt: moment().unix(), main: { temp: 20, humidity: 50 }, wind: { speed: 3 } }
            ]
        };
        const shareLink = generateWeatherShareLink('Kyiv', mockWeatherData, 'today');
        const decodedLink = decodeURIComponent(shareLink);
        expect(decodedLink).toContain('🌍 *Погода в місті Kyiv:*');
        expect(decodedLink).toContain('20.0°C');
    });  
});