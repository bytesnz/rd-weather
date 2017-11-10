"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var childProcess = require('child_process');
var exec = function (command, options) {
    return new Promise(function (resolve, reject) {
        childProcess.exec(command, options, function (error, stdout, stderr) {
            var output = {
                code: 0,
                stdout: stdout,
                stderr: stderr,
                signal: null
            };
            if (error) {
                output.code = error.code;
                output.signal = error.signal;
            }
            resolve(output);
        });
    });
};
var process = require("process");
var schedule = require('node-schedule');
var speed_1 = require("units-shake/speed");
var temperature_1 = require("units-shake/temperature");
var pressure_1 = require("units-shake/pressure");
var length_1 = require("units-shake/length");
//const MoltenDB = require('molten-core').default;
//const MDBJsonCrud = require('molten-storage-json-crud').default;
var molten_core_1 = require("molten-core");
var molten_storage_json_crud_1 = require("molten-storage-json-crud");
var moment = require("moment");
var schemas_1 = require("./lib/schemas");
var mappings_1 = require("./lib/mappings");
var round = function (value, decimalPlaces) {
    var multiplier = Math.pow(10, decimalPlaces);
    return Math.round(value * multiplier) / multiplier;
};
//const schemas = require('./lib/schemas');
var liveWeatherInterval = 60;
var cronString = '* * * * *';
var vproweatherCmd = 'vproweather -d20';
var serialDevice = '/dev/ttyUSB0';
molten_core_1.default({
    storage: {
        default: {
            connect: molten_storage_json_crud_1.default,
            options: {
                baseFolder: 'data',
                keepConnected: true
            }
        }
    },
    collectionsStorage: {
        storage: 'default',
        collection: 'collections'
    }
}).then(function (mdb) {
    // Check that the collections have been created
    return Promise.all([
        mdb.checkCollection('liveWeather'),
        mdb.checkCollection('weatherArchive')
    ]).then(function (_a) {
        var liveGood = _a[0], archiveGood = _a[1];
        var collectionFixes = [];
        if (typeof liveGood === 'undefined') {
            collectionFixes.push(mdb.createCollection(schemas_1.liveWeather));
        }
        else if (!liveGood) {
            collectionFixes.push(Promise.reject(new Error('Problem with live database')));
        }
        else {
            collectionFixes.push(mdb.collection('liveWeather'));
        }
        if (typeof archiveGood === 'undefined') {
            collectionFixes.push(mdb.createCollection(schemas_1.weatherArchive));
        }
        else if (!archiveGood) {
            collectionFixes.push(Promise.reject(new Error('Problem with archive database')));
        }
        else {
            collectionFixes.push(mdb.collection('weatherArchive'));
        }
        return Promise.all(collectionFixes);
    }).then(function (_a) {
        var liveWeather = _a[0], weatherArchive = _a[1];
        // Check the archive length
        console.log('running command to get interval');
        return exec(process.env.NODE_ENV !== 'production' ? "cat ./testData/archivePeriod.out" : vproweatherCmd + " -i " + serialDevice)
            .then(function (_a) {
            var stdout = _a.stdout, stderr = _a.stderr;
            var archivePeriod;
            var match = stdout.match(/^archiveTime = (\d+)$/m);
            if (match) {
                archivePeriod = parseInt(match[1]);
            }
            console.log('archivePeriod is', archivePeriod);
            if (typeof archivePeriod === 'undefined' || isNaN(archivePeriod)) {
                return Promise.reject(new Error('Could not get archive period of station'));
            }
            var nextRecord;
            var lastArchiveDate;
            /**
             * Request all the archive records since the archive record for the date
             * given from the weather station
             *
             * @param data Date of the archive record to retrieve all records after
             */
            var importArchiveRecords = function (date) {
                var promise;
                if (process.env.NODE_ENV !== 'production') {
                    console.log('importing archive records', (date ? "since " + moment(date).format('YYYY-MM-DDTHH:mm') : ''));
                }
                if (date) {
                    promise = exec(process.env.NODE_ENV !== 'production' ? "cat ./testData/archiveRecord.out" : vproweatherCmd + " -a" + moment(date).format('YYYY-MM-DDTHH:mm') + " " + serialDevice);
                }
                else {
                    promise = exec(process.env.NODE_ENV !== 'production' ? "cat ./testData/archiveRecord.out" : vproweatherCmd + " -a " + serialDevice);
                }
                return promise.then(function (_a) {
                    var stdout = _a.stdout, stderr = _a.stderr, code = _a.code, signal = _a.signal;
                    if (code !== 0) {
                        console.error("Archive command returned " + code + ":\n", stderr);
                    }
                    var lines = stdout.split('\n');
                    var records = [];
                    lines.forEach(function (line) {
                        var record = {};
                        var values = line.split(',');
                        if (values.length === mappings_1.archiveMapping.length) {
                            values.forEach(function (value, index) {
                                if (mappings_1.archiveMapping[index]) {
                                    record[mappings_1.archiveMapping[index]] = value;
                                }
                            });
                            // Parse values
                            record._id = moment(record.date + "T" + record.time).toDate();
                            delete record['time'];
                            delete record['date'];
                            // Parse Floats
                            [
                                'temperature', 'temperatureHigh', 'temperatureLow', 'barometer'
                            ].forEach(function (value) {
                                if (record[value] !== '') {
                                    record[value] = parseFloat(record[value]);
                                }
                                else {
                                    record[value] = null;
                                }
                            });
                            // Parse Ints
                            [
                                'rainfall', 'peakRainRate', 'windSamples', 'averageWindSpeed',
                                'peakWindSpeed', 'averageSolarRadiation', 'peakSolarRadiation',
                                'averageUvIndex', 'peakUvIndex', 'accumulatedEt', 'humidity'
                            ].forEach(function (value) {
                                if (record[value] !== '') {
                                    record[value] = parseInt(record[value]);
                                }
                                else {
                                    record[value] = null;
                                }
                            });
                            // Convert pressure
                            [
                                'barometer'
                            ].forEach(function (value) {
                                if (record[value] !== null) {
                                    record[value] = Math.round(pressure_1.pressureinHgtomb(record[value]));
                                }
                            });
                            // Convert temperatures
                            [
                                'temperature', 'temperatureHigh', 'temperatureLow'
                            ].forEach(function (value) {
                                if (record[value] !== null) {
                                    record[value] = round(temperature_1.temperatureFtoC(record[value]), 1);
                                }
                            });
                            // Convert wind speeds
                            [
                                'averageWindSpeed', 'peakWindSpeed'
                            ].forEach(function (value) {
                                if (record[value] !== null) {
                                    record[value] = round(speed_1.speedmphtokn(record[value]), 1);
                                }
                            });
                            // Convert rain rates
                            [
                                'rainfall', 'peakRainRate'
                            ].forEach(function (value) {
                                if (record[value] !== null) {
                                    record[value] = Math.round(length_1.lengthintomm(0.01 * record[value]));
                                }
                            });
                            // Calculate the approximate dew point
                            record.dewPoint = round((record.temperature - (100 - record.humidity) / 5), 1);
                            records.push(record);
                        }
                    });
                    if (records.length) {
                        return weatherArchive.update(records).then(function () { return records[records.length - 1]; });
                    }
                });
            };
            /**
             * Download the live weather from the weather station and store it in the
             * database iff the time is in sync with a NTP server
             *
             * @param skipImport Skip the import of the weather into the database
             */
            var importLiveWeather = function (skipImport) {
                if (skipImport === void 0) { skipImport = false; }
                return exec(process.env.NODE_ENV !== 'production' ? "cat ./testData/liveRecord.out" : vproweatherCmd + " -x " + serialDevice).then(function (_a) {
                    var stdout = _a.stdout, stderr = _a.stderr, code = _a.code, signal = _a.signal;
                    if (code !== 0) {
                        console.error("Live command returned " + code + ":\n", stderr);
                    }
                    var lines = stdout.split('\n');
                    var record = {
                        _id: new Date(),
                        date: new Date()
                    };
                    lines.forEach(function (line) {
                        var match = line.match(/^(.*) = (.*)$/);
                        if (match) {
                            if (typeof mappings_1.liveMapping[match[1]] !== 'undefined') {
                                record[mappings_1.liveMapping[match[1]]] = match[2];
                            }
                        }
                    });
                    // Parse isRaining
                    if (record['isRaining'] === 'yes') {
                        record['isRaining'] = true;
                    }
                    else {
                        record['isRaining'] = false;
                    }
                    // Parse Ints
                    [
                        'nextArchiveRecord', 'windSpeed', 'humidity', 'solarRadiation',
                        'heatIndex', 'thswIndex', 'rainRate', 'stormRain',
                        'rainLast15m', 'rainLastHour', 'rainToday'
                    ].forEach(function (value) {
                        if (record[value] !== '') {
                            record[value] = parseInt(record[value]);
                        }
                        else {
                            record[value] = null;
                        }
                    });
                    // Parse Floats
                    [
                        'temperature', 'barometer', 'wind10minAverage', 'wind2minAverage',
                        'wind10minMaxSpeed', 'consoleBattery'
                    ].forEach(function (value) {
                        if (record[value] !== '') {
                            record[value] = parseFloat(record[value]);
                        }
                        else {
                            record[value] = null;
                        }
                    });
                    // Convert pressure
                    [
                        'barometer'
                    ].forEach(function (value) {
                        if (record[value] !== null) {
                            record[value] = Math.round(pressure_1.pressureinHgtomb(record[value]));
                        }
                    });
                    // Convert temperatures
                    [
                        'temperature'
                    ].forEach(function (value) {
                        if (record[value] !== null) {
                            record[value] = round(temperature_1.temperatureFtoC(record[value]), 1);
                        }
                    });
                    // Convert wind speeds
                    [
                        'windSpeed', 'wind10minAverage', 'wind2minAverage', 'wind10minMaxSpeed'
                    ].forEach(function (value) {
                        if (record[value] !== null) {
                            record[value] = round(speed_1.speedmphtokn(record[value]), 1);
                        }
                    });
                    // Convert rain rates
                    [
                        'rainRate', 'stormRain', 'rainLast15m', 'rainLastHour', 'rainToday'
                    ].forEach(function (value) {
                        if (record[value] !== null) {
                            record[value] = Math.round(length_1.lengthintomm(0.01 * record[value]));
                        }
                    });
                    if (skipImport) {
                        return Promise.resolve(record);
                    }
                    else {
                        // Check the time is in sync with NTP using timedatectl
                        return exec('timedatectl | grep \'NTP synchronized: yes\'').then(function (output) {
                            if (!output.code) {
                                // Save to the database
                                return liveWeather.update([record]).then(function () {
                                    return record;
                                });
                            }
                            else {
                                console.log('Not storing live weather and time not syncronised');
                                return record;
                            }
                        });
                    }
                });
            };
            // Get latest live weather
            return importLiveWeather(true).then(function (liveWeatherRecord) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('liveRecord', liveWeatherRecord);
                }
                nextRecord = liveWeatherRecord.nextArchiveRecord;
                // Download archive records since last record in the archive
                return weatherArchive.read(null, {
                    sort: {
                        _id: -1
                    },
                    limit: 1
                });
            }).then(function (results) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('got results from archive', results);
                }
                if (results.length) {
                    return importArchiveRecords(results.row(0)._id.valueOf());
                }
                else {
                    return importArchiveRecords();
                }
            }).then(function (archiveRecord) {
                if (archiveRecord) {
                    lastArchiveDate = archiveRecord._id;
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log('got archive record', archiveRecord);
                }
                console.log('Starting update job');
                // Set up interval to download the live weather
                var j = schedule.scheduleJob(cronString, function () {
                    importLiveWeather().then(function (liveWeather) {
                        console.log(moment(liveWeather.date).format('HH:mm') + ": Temp: " + liveWeather.temperature + "\u00B0C Wind: " + liveWeather.windSpeed + "kn gusting " + liveWeather.wind10minMaxSpeed + " " + liveWeather.wind10minMaxDirectoion + "\u00B0 Rain " + liveWeather.rainRate + "mm/hr");
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Next archive record', liveWeather.nextArchiveRecord, nextRecord);
                        }
                        if (liveWeather.nextArchiveRecord !== nextRecord) {
                            console.log('Retrieving archive records');
                            return importArchiveRecords(lastArchiveDate)
                                .then(function (archiveRecord) {
                                if (archiveRecord) {
                                    lastArchiveDate = archiveRecord._id;
                                }
                                nextRecord = liveWeather.nextArchiveRecord;
                            });
                        }
                    });
                });
            });
        });
    });
}).catch(function (error) {
    console.error('Error', error);
});
