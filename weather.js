const axios = require('axios');
const moment = require('moment');
const { OPENWEATHERMAP_API_KEY } = process.env;


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
        const date = moment.unix(forecast.dt).format('YYYY-MM-DD');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(forecast);
        return acc;
    }, {});

    const forecastEntries = Object.entries(forecastsByDate);
    const selectedForecasts = days === 1 ? [forecastEntries[0]] : forecastEntries.slice(0, 7);

    return selectedForecasts.map(([date, forecasts]) => {
        const formattedDate = moment(date).format('dddd, D MMMM YYYY');
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

function generateWeatherShareLink(city, weatherData, forecastType) {
    const forecast = forecastType === 'today' ? parseWeatherForecast(weatherData, 1) : parseWeatherForecast(weatherData, 7);
    const message = `🌍 *Погода в місті ${city}:*\n\n${forecast}\n\n☀️ Залишайтесь на зв'язку з нашим ботом для отримання актуальної інформації!`;
    const encodedMessage = encodeURIComponent(message);
    const url = `https://t.me/share/url?url=${encodedMessage}`;
    return url;
}

module.exports = { getWeather, getCityByCoordinates, formatCityWeatherMessage, generateWeatherShareLink };