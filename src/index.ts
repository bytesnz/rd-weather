const childProcess = require('child_process');
const exec = (command: string, options?: any) => {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        stdout,
        stderr
      });
    });
  });
};

import * as process from 'process';
const schedule = require('node-schedule');

import { ArchiveRecord, LiveWeather } from './typings/records';

import { speedmphtokn } from 'units-shake/speed';
import { temperatureFtoC } from 'units-shake/temperature';
import { pressureinHgtomb } from 'units-shake/pressure';
import { lengthintomm } from 'units-shake/length';

//const MoltenDB = require('molten-core').default;
//const MDBJsonCrud = require('molten-storage-json-crud').default;
import MoltenDB from 'molten-core';
import MDBJsonCrud from 'molten-storage-json-crud';

import { weatherArchive, liveWeather } from './lib/schemas';

import { archiveMapping, liveMapping } from './lib/mappings';

const round = (value: number, decimalPlaces: number): number => {
  const multiplier = Math.pow(10, decimalPlaces);

  return Math.round(value * multiplier) / multiplier;
};

//const schemas = require('./lib/schemas');

const liveWeatherInterval = 60;
const cronString = '* * * * *';

const vproweatherCmd = 'vproweather -d2';
const serialDevice = '/dev/ttyUSB0';


console.log(MoltenDB);
MoltenDB({
  storage: {
    default: {
      connect: MDBJsonCrud,
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
}).then((mdb) => {
  // Check that the collections have been created
  return Promise.all([
    mdb.checkCollection('liveWeather'),
    mdb.checkCollection('weatherArchive')
  ]).then(([ liveGood, archiveGood ]) => {
    let collectionFixes = [];

    if (typeof liveGood === 'undefined') {
      collectionFixes.push(mdb.createCollection(liveWeather));
    } else if (!liveGood) {
      collectionFixes.push(Promise.reject(new Error('Problem with live database')));
    } else {
      collectionFixes.push(mdb.collection('liveWeather'));
    }

    if (typeof archiveGood === 'undefined') {
      collectionFixes.push(mdb.createCollection(weatherArchive));
    } else if (!archiveGood) {
      collectionFixes.push(Promise.reject(new Error('Problem with archive database')));
    } else {
      collectionFixes.push(mdb.collection('weatherArchive'));
    }

    return Promise.all(collectionFixes);
  }).then(([liveWeather, weatherArchive]) => {
    // Check the archive length
    console.log('running command to get interval');
    return exec(process.env.NODE_ENV !== 'production' ? `cat ./testData/archivePeriod.out` : `${vproweatherCmd} -i ${serialDevice}`)
        .then(({stdout, stderr}) => {

      let archivePeriod;
      const match = stdout.match(/^archiveTime = (\d+)$/m);

      if (match) {
        console.log('match');
        archivePeriod = parseInt(match[1]);
      }
      console.log('archivePeriod is', archivePeriod);

      if (typeof archivePeriod === 'undefined' || isNaN(archivePeriod)) {
        return Promise.reject(new Error('Could not get archive period of station'));
      }

      let nextRecord;
      let lastArchiveDate;

      const importArchiveRecords = (date?: Date): Promise<ArchiveRecord> => {
        let promise;
        if (date) {
          promise = exec(process.env.NODE_ENV !== 'production' ? `cat ./testData/archiveRecord.out` : `${vproweatherCmd} -a${date.toISOString()} ${serialDevice}`);
        } else {
          promise = exec(process.env.NODE_ENV !== 'production' ? `cat ./testData/archiveRecord.out` : `${vproweatherCmd} -a ${serialDevice}`);
        }

        return promise.then(({stdout, stderr}) => {
          const lines = stdout.split('\n');
          let records = [];

          lines.forEach((line) => {
            let record: any = {};
            const values = line.split(',');

            if (values.length === archiveMapping.length) {
              values.forEach((value, index) => {
                if (archiveMapping[index]) {
                  record[archiveMapping[index]] = value;
                }
              });

              // Parse values
              record._id = new Date(`${record.date}T${record.time}`);
              delete record['time'];
              delete record['date'];

              // Parse Floats
              [
                'temperature', 'temperatureHigh', 'temperatureLow', 'barometer'
              ].forEach((value) => {
                if (record[value] !== '') {
                  record[value] = parseFloat(record[value]);
                } else {
                  record[value] = null;
                }
              });
              // Parse Ints
              [
                'rainfall', 'peakRainRate', 'windSamples', 'averageWindSpeed',
                'peakWindSpeed', 'averageSolarRadiation', 'peakSolarRadiation',
                'averageUvIndex','peakUvIndex', 'accumulatedEt', 'humidity'
              ].forEach((value) => {
                if (record[value] !== '') {
                  record[value] = parseInt(record[value]);
                } else {
                  record[value] = null;
                }
              });

              // Convert pressure
              [
                'barometer'
              ].forEach((value) => {
                if (record[value] !== null) {
                  record[value] = Math.round(pressureinHgtomb(record[value]));
                }
              });

              // Convert temperatures
              [
                'temperature', 'temperatureHigh', 'temperatureLow'
              ].forEach((value) => {
                if (record[value] !== null) {
                  record[value] = round(temperatureFtoC(record[value]), 1);
                }
              });

              // Convert wind speeds
              [
                'averageWindSpeed', 'peakWindSpeed'
              ].forEach((value) => {
                if (record[value] !== null) {
                  record[value] = round(speedmphtokn(record[value]), 1);
                }
              });

              // Convert rain rates
              [
                'rainfall', 'peakRainRate'
              ].forEach((value) => {
                if (record[value] !== null) {
                  record[value] = Math.round(lengthintomm(0.01 * record[value]));
                }
              });

              // Calculate the approximate dew point
              record.dewPoint = round((record.temperature - (100 - record.humidity) / 5), 1);

              records.push(record);
            }
          });

          if (records.length) {
            return weatherArchive.update(records).then(() => records[records.length - 1]);
          }
        });
      };

      const importLiveWeather = (skipImport: boolean = false): Promise<LiveWeather> => {
        return exec(process.env.NODE_ENV !== 'production' ? `cat ./testData/liveRecord.out` : `${vproweatherCmd} -x ${serialDevice}`) .then(({stdout, stderr}) => {
          const lines = stdout.split('\n');
          let record = {
            _id: new Date(),
            date: new Date()
          };

          lines.forEach((line) => {
            const match = line.match(/^(.*) = (.*)$/);

            if (match) {
              if (typeof liveMapping[match[1]] !== 'undefined') {
                record[liveMapping[match[1]]] = match[2];
              }
            }
          });

          // Parse Ints
          [
            'nextArchiveRecord', 'windSpeed', 'humidity', 'solarRadiation',
            'heatIndex', 'thswIndex', 'rainRate', 'stormRain',
            'rainLast15m', 'rainLastHour', 'rainToday'
          ].forEach((value) => {
            if (record[value] !== '') {
              record[value] = parseInt(record[value]);
            } else {
              record[value] = null;
            }
          });

          // Parse Floats
          [
            'temperature', 'barometer', 'wind10minAverage', 'wind2minAverage',
            'wind10minMaxSpeed', 'consoleBattery'
          ].forEach((value) => {
            if (record[value] !== '') {
              record[value] = parseFloat(record[value]);
            } else {
              record[value] = null;
            }
          });

          // Convert pressure
          [
            'barometer'
          ].forEach((value) => {
            if (record[value] !== null) {
              record[value] = Math.round(pressureinHgtomb(record[value]));
            }
          });

          // Convert temperatures
          [
            'temperature'
          ].forEach((value) => {
            if (record[value] !== null) {
              record[value] = round(temperatureFtoC(record[value]), 1);
            }
          });

          // Convert wind speeds
          [
            'windSpeed', 'wind10minAverage', 'wind2minAverage', 'wind10minMaxSpeed'
          ].forEach((value) => {
            if (record[value] !== null) {
              record[value] = round(speedmphtokn(record[value]), 1);
            }
          });

          // Convert rain rates
          [
            'rainRate', 'stormRain', 'rainLast15m', 'rainLastHour', 'rainToday'
          ].forEach((value) => {
            if (record[value] !== null) {
              record[value] = Math.round(lengthintomm(0.01 * record[value]));
            }
          });

          if (skipImport) {
            return Promise.resolve(record);
          } else {
            // Save to the database
            return liveWeather.update([record]).then(() => {
              return record;
            });
          }
        });
      };

      // Get latest live weather
      return importLiveWeather(true).then((liveWeatherRecord) => {

        console.log('liveRecord', liveWeatherRecord);
        nextRecord = liveWeatherRecord.nextArchiveRecord;

        // Download archive records since last record in the archive
        return weatherArchive.read(null, {
          sort: {
            _id: -1
          },
          limit: 1
        });
      }).then((results) => {
        console.log('got results from archive', results);

        if (results.length) {
          return importArchiveRecords(results.row(0)._id.valueOf());
        } else {
          return importArchiveRecords();
        }
      }).then((archiveRecord) => {
        if (archiveRecord) {
          lastArchiveDate = archiveRecord._id;
        }

        console.log('got archive record', archiveRecord);

        console.log('Starting update job');
        // Set up interval to download the live weather
        var j = schedule.scheduleJob(cronString, () => {
          console.log('Getting latest live weather');
          importLiveWeather().then((liveWeather) => {
            if (liveWeather.nextArchiveRecord !== nextRecord) {
              return importArchiveRecords(lastArchiveDate)
                  .then((archiveRecord) => {
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
}).catch((error) => {
  console.error('Error', error);
});
