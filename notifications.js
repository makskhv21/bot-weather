const moment = require('moment');
const { getWeather, formatCityWeatherMessage } = require('./weather');
const users = {};

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

module.exports = { checkNotifications };