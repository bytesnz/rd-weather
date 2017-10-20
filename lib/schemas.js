"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveWeather = {
    name: 'liveWeather',
    label: 'Live Weather',
    description: 'Ring buffer of the last 24 hours of weather at Reef Doctor',
    storage: {
        default: {
            type: 'default',
            name: 'liveWeather'
        }
    },
    fields: {
        _id: {
            type: 'date',
            format: 'time',
            label: 'Time',
            description: 'Time that the data was recorded',
            required: true
        },
        date: {
            type: 'date',
            format: 'date',
            label: 'Date',
            description: 'Date that the data was recorded',
            required: true
        },
        barometer: {
            type: 'number',
            label: 'Barometer',
            suffix: ''
        },
        barometerTrend: {
            type: 'string',
            label: 'Barometer Trend',
        },
        temperature: {
            type: 'number',
            label: 'Temperature',
            suffix: '°C'
        },
        windSpeed: {
            type: 'number',
            label: 'Wind Speed',
            description: 'Wind speed at time of recording',
            suffix: 'knots'
        },
        windDirection: {
            type: 'number',
            label: 'Wind Direction',
            description: 'Wind direction at time of recording',
            suffix: '°'
        },
        wind2minAverage: {
            type: 'number',
            label: 'Two-minute Average Wind Speed',
            suffix: 'knots'
        },
        wind10minAverage: {
            type: 'number',
            label: 'Ten-minute Average Wind Speed',
            suffix: 'knots'
        },
        wind10minMaxSpeed: {
            type: 'number',
            label: 'Biggest Gust in Last Ten-minutes',
            suffix: '°'
        },
        wind10minMaxDirection: {
            type: 'number',
            label: 'Direction of Biggeset Gust in Last Ten-minutes',
            suffix: '°'
        },
        humidity: {
            type: 'number',
            label: 'Humidity',
            suffix: '%'
        },
        rainRate: {
            type: 'number',
            label: 'Rain Rate',
            description: 'Rain rate at time of recording',
            suffix: 'mm/hr'
        },
        isRaining: {
            type: 'boolean',
            label: 'Is Raining',
        },
        rainLast15min: {
            type: 'number',
            label: 'Rain in Last 15 Minutes',
            suffix: 'mm'
        },
        rainLastHour: {
            type: 'number',
            label: 'Rain in Last Hour',
            suffix: 'mm'
        },
        rainToday: {
            type: 'number',
            label: 'Rain in the Last 24 Hours',
            suffix: 'mm'
        },
        thswIndex: {
            type: 'number',
            label: 'Feels Like Temperature',
            description: 'THSW Index',
            suffix: '°'
        },
        batteryVoltage: {
            type: 'number',
            label: 'Battery Voltage',
            suffix: 'V'
        },
        forecast: {
            type: 'string',
            label: 'Forecast',
        },
        sunset: {
            label: 'Sunset',
            type: 'string'
            /*TODO type: 'date',
            format: 'time',
            convert: true*/
        },
        sunrise: {
            label: 'Sunrise',
            type: 'string'
            /*TODO type: 'date',
            format: 'time',
            convert: true*/
        }
    }
};
exports.weatherArchive = {
    name: 'weatherArchive',
    label: 'Weather Records',
    description: 'Weather records from Reef Doctor',
    storage: {
        default: {
            type: 'default',
            name: 'weatherArchive'
        }
    },
    fields: {
        _id: {
            type: 'date',
            label: 'Record Datetime'
        },
        temperature: {
            type: 'number',
            label: 'Temperature',
            suffix: '°C'
        },
        temperatureHi: {
            type: 'number',
            label: 'Temperature High',
            suffix: '°C'
        },
        temperatureLow: {
            type: 'number',
            label: 'Temperature Low',
            suffix: '°C'
        },
        humidity: {
            type: 'number',
            label: 'Humidity',
            suffix: '%'
        },
        dewPoint: {
            type: 'number',
            label: 'Dew Point',
            suffix: '°C'
        },
        windChill: {
            type: 'number',
            label: 'Wind Chill',
            suffix: '°C'
        },
        heatIndex: {
            type: 'number',
            label: 'Heat Index',
            suffix: '°C'
        },
        thswIndex: {
            type: 'number',
            label: 'THSW Index',
            suffix: '°C'
        },
        rainfall: {
            type: 'number',
            label: 'Rainfall',
            description: 'Rainfall over period',
            suffix: 'mm'
        },
        peakRainRate: {
            type: 'number',
            label: 'Peak Rain Rate',
            description: 'Peak rain rate over period',
            suffix: 'mm/hr'
        },
        windSamples: {
            type: 'number',
            label: 'Wind Samples',
            description: 'Number of wind samples taken',
        },
        averageWindSpeed: {
            type: 'number',
            label: 'Average Wind Speed',
            suffix: 'knots'
        },
        prevailingWindDirection: {
            type: 'string',
            label: 'Prevailing Wind Direction',
        },
        peakWindSpeed: {
            type: 'number',
            label: 'Peak Wind Speed',
            suffix: 'knots'
        },
        peakWindSpeedDirection: {
            type: 'string',
            label: 'Direction of Peak Wind Speed',
        },
        averageSolarRadiation: {
            type: 'number',
            label: 'Average Solar Radiation',
            suffix: 'W/m^2'
        },
        peakSolarRadiation: {
            type: 'number',
            label: 'Peak Solar Radiation',
            suffix: 'W/m^2'
        },
        averageUvIndex: {
            type: 'number',
            label: 'Average UV Index',
        },
        peakUvIndex: {
            type: 'number',
            label: 'Peak UV Index',
        },
        accumulatedEt: {
            type: 'number',
            label: 'Accumulated ET',
        }
    }
};
