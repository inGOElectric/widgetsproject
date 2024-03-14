const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const { createPool } = require('mysql');
const xlsx = require('xlsx');
const mysql = require('mysql');
const imeiToObject = {}; // Define imeiToObject at a higher scope
const bodyParser = require('body-parser');
const moment = require('moment');
const _ = require('lodash');
const getTableNamesQuery = `SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = 'ingodata';`;
const fs = require('fs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
const pool = createPool({
  host: 'database-1.cbjabnlglbz6.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'ingo4321',
  database: 'ingodata',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 60000, // 60 seconds
});
// Serve static files from the "public" folder
app.use(express.static('public'));

// Define a route for the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// Define a route for the base.html page
app.get('/base.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'base.html'));
});
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});
app.post('/all-data', (req, res) => {
  const dateTimeRange = req.body.dateTimeRange;
  const [fromDateTime, toDateTime] = dateTimeRange.split(' - ');
  const fromDateTimeObj = new Date(fromDateTime);
  const toDateTimeObj = new Date(toDateTime);
  const fromDateTimeSQL = fromDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');
  const toDateTimeSQL = toDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');

      const connection = mysql.createConnection({
        host: 'database-1.cbjabnlglbz6.ap-south-1.rds.amazonaws.com',
        user: 'admin',
        password: 'ingo4321',
          database: 'top5',
      });
      const newQuery = "SELECT * FROM travel_summary ";
      connection.query(newQuery, (error, results5, fields) => {
          if (error) {
              console.error('Error executing query:', error);
          } else {
              console.log('Query results:');
          }
          const datafromtop5 = results5;
          const odocolumn = datafromtop5.map(item => ({ 'vehicle': item['Object'], 'EndOdometer': item['EndOdometer'] }));
          const sortdata = odocolumn.sort((a, b) => b['EndOdometer'] - a['EndOdometer']);
          const top5Records = sortdata.slice(0, 5);
          const toparray = JSON.stringify(top5Records);

          const Query = "SELECT * FROM results1 ";
          connection.query(Query, (error, results2, fields) => {
              if (error) {
                  console.error('Error executing query:', error);
              } else {
                  console.log("");
              }

              const countofInactive = results2.map(item => ({ 'vehicle': item['table_name'], 'Count': item['row_count'] }));
              const countOfZeroCounts = countofInactive.filter(item => item.Count === 0).length;
              const nonZeroCount = countofInactive.filter(item => item.Count > 0).length;

              const htmlTemplatePath = path.join(__dirname, 'public', 'result2.html');
              fs.readFile(htmlTemplatePath, 'utf8', (err, template) => {
                  if (err) {
                      console.error('Error reading template file:', err);
                      return res.status(500).send('Error reading template file');
                  }

                  const renderedHtml = template
                      .replace('{{fromDateTimeObj}}', fromDateTimeObj)
                      .replace('{{toDateTimeObj}}', toDateTimeObj)
                      .replace('{{toparray}}', toparray)
                      .replace('{{nonZeroCount}}', nonZeroCount)
                      .replace('{{countOfZeroCounts}}', countOfZeroCounts);
                  res.send(renderedHtml);
              });
          });
      });
  });
app.post('/whole-data', (req, res) => {
  const dateTimeRange = req.body.dateTimeRange;
  const [fromDateTime, toDateTime] = dateTimeRange.split(' - ');
  const fromDateTimeObj = new Date(fromDateTime);
  const toDateTimeObj = new Date(toDateTime);
  const fromDateTimeSQL = fromDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');
  const toDateTimeSQL = toDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');
  const connection = mysql.createConnection({
    host: 'database-1.cbjabnlglbz6.ap-south-1.rds.amazonaws.com',
    user: 'admin',
    password: 'ingo4321',
    database: 'ingodata',
  });
  const filteredResultsArray = [];
  connection.query('CALL SumOdoInDateRange(?, ?)', [fromDateTimeObj, toDateTimeObj], (error, results) => {
      if (error) {
          console.error('Error executing stored procedure: ', error);
          return;
      }
      const actualResults = results.slice(0, results.length - 1);
      if (actualResults[0].AverageSpeed !== null) {
          filteredResultsArray.push(actualResults[0]);
          console.log(filteredResultsArray[0]);
      }
	    res.json(filteredResultsArray[0]);

    });
  });

app.get('/getTableNames', (req, res) => {
    pool.query(getTableNamesQuery, (err, results) => {
        if (err) {
            console.error('Error fetching table names:', err);
            return res.status(500).json({ error: 'Error fetching table names' });
        }
        const connection = mysql.createConnection({
          host: 'database-1.cbjabnlglbz6.ap-south-1.rds.amazonaws.com',
          user: 'admin',
          password: 'ingo4321',
            database: 'top5',
        });
        const newQuery = "SELECT * FROM results1 ";
        connection.query(newQuery, (error, results2, fields) => {
          if (error) {
            console.error('Error executing query:', error);
          } else {
            const tableInfo = results2.map((row) => ({
              tableName:row.table_name,
              rowCount:row.row_count,
            }));
            res.json({ tableInfo });
  
          }
        });
    });
  });
app.post('/fetch-data', (req, res) => {
    const selectedTable = req.body.table;
    const dateTimeRange = req.body.dateTimeRange;
    const [fromDateTime, toDateTime] = dateTimeRange.split(' - ');
    const fromDateTimeObj = new Date(fromDateTime);
    const toDateTimeObj = new Date(toDateTime);
    const fromDateTimeSQL = fromDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');
    const toDateTimeSQL = toDateTimeObj.toISOString().slice(0, 19).replace('T', ' ');  // querying database and fetching data based on selected table and selected date
    const fetchDataQuery = `SELECT * FROM \`${selectedTable}\`WHERE date_time BETWEEN STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s') AND STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s');`;
    pool.query(fetchDataQuery, [fromDateTimeObj, toDateTimeObj], (err, results) => {
        if (err) {
            console.error(`Error fetching data from ${selectedTable}:`, err);
            return res.status(500).send(`Error fetching data from ${selectedTable}`);
        }
        if (!results || results.length === 0) {
            // Handle the case when no data is found
            const noDataHtml = `
            </br>
            </br>
            </br>
            </br>
            </br>
            </br>
            </br>
            </br>
            <h1>No data found for the selected date range.</h1>
            `;
            return res.send(noDataHtml);
        }

const data = results;
const formattedDataArray = data.map(item => {
  return {
    ...item,
    date_time: item.date_time.toLocaleString() // Convert to a human-readable format
  };
});
let currentGroup = 1;
const dataWithGroup = data.map((entry, index) => {
  if (index > 0 && entry.IGN !== data[index - 1].IGN) {
    currentGroup += 1;
  }
  return { ...entry, Group: currentGroup };
});
const offGroupCounts = dataWithGroup.reduce((counts, entry) => {
  if (entry.IGN === 'OFF') {
    counts[entry.Group] = (counts[entry.Group] || 0) + 1;
  }
  return counts;
}, {});
const filteredData1 = dataWithGroup.filter(
  (entry) => entry.IGN !== 'OFF' || offGroupCounts[entry.Group] >= 3
);
let currentGroup1 = 1;
const dataWithGroup1 = filteredData1.map((entry, index) => {
  if (index > 0 && entry.IGN !== filteredData1[index - 1].IGN) {
    currentGroup1 += 1;
  }
  return { ...entry, Group1: currentGroup1 };
});
const onGroups1 = dataWithGroup1.filter((item) => item.IGN === 'ON');
onGroups1.sort((a, b) => a.Group1 - b.Group1 || new Date(a.date_time) - new Date(b.date_time));
onGroups1.forEach((group, index, array) => {
  if (index > 0 && group.Group1 === array[index - 1].Group1) {
    const groupStartTime = new Date(array[index - 1].date_time);
    const groupEndTime = new Date(group.date_time);
    if (!isNaN(groupStartTime) && !isNaN(groupEndTime)) {
      const timeDifferenceInSeconds = (groupEndTime - groupStartTime) / 1000;
      group['Time Difference (s)'] = timeDifferenceInSeconds;
    } else {
      group['Time Difference (s)'] = 'Invalid Date';
    }
  }
});
const filteredOnGroups1 = onGroups1.filter((group) => {
  const timeDifferenceInSeconds = group['Time Difference (s)'];
  // Filter criteria: Time Difference greater than 1000 seconds
  return typeof timeDifferenceInSeconds === 'number' && timeDifferenceInSeconds < 180;
});
const sumTimeDifferenceByGroup1 = filteredOnGroups1.reduce((acc, group) => {
  const group1 = group.Group1;
  const timeDifferenceInSeconds = group['Time Difference (s)'];
  // Sum the time differences for each Group1
  acc[group1] = (acc[group1] || 0) + timeDifferenceInSeconds;
  return acc;
}, {});
const filteredSumTimeDifference = Object.fromEntries(
    Object.entries(sumTimeDifferenceByGroup1)
      .filter(([group, timeDifference]) => timeDifference > 60)
  );
  // Calculate the length of the filtered array
  const filteredSumTimeDifferenceLength = Object.keys(filteredSumTimeDifference).length;

const speedArray = data.map(item => item.Speed);
const subLists = [];
let start = 0;
for (let i = 1; i < speedArray.length; i++) {
    if (speedArray[i] < speedArray[i - 1]) {
        subLists.push(speedArray.slice(start, i));
        start = i;
    }
}
subLists.push(speedArray.slice(start)); 
let id_count = 0;
let id_list = [];
for (const unit of subLists) {
    if (Math.min(...unit) <= 5  && Math.max(...unit) >= 25  && new Set(unit).size > 1) {
        id_count++;
        id_list.push(unit);
    }
}
        let totalDistance = 0;
           let avgonhours = 0;                      // avg onhours widget
           for (let i = 0; i < data.length - 1; i++) {
             if (data[i]['IGN'] === 'ON' && data[i + 1]['IGN'] === 'OFF') {
        // Calculate the time difference between the current and next rows
               const currentTime = new Date(data[i]['date_time']);
               const nextTime = new Date(data[i + 1]['date_time']);
               const timeDifference = (nextTime - currentTime) / 3600000; // Convert milliseconds to hours
               avgonhours += timeDifference;
                }
                }
            const roundedAvgonhours = avgonhours.toFixed(2);
            let avgoffhours = 0;
            for (let i=0; i<data.length - 1; i++) {
               if(data[i]['IGN'] === 'OFF' && data[i+1]['IGN'] === 'ON') {
                 const currentTime = new Date(data[i]['date_time']);
                 const nextTime = new Date(data[i+1]['date_time']);
                 const timeDifference = (nextTime - currentTime) / 3600000;
                 avgoffhours +=timeDifference;
                }
            }
            const roundedAvgoffhours = avgoffhours.toFixed(2);
           let sumOfAverageVoltage = 0;
           let filteredDataLength = 0;
           let avgvoltage = 0; // Initialize avgvoltage
           
           for (let i = 0; i < data.length; i++) {
               if (data[i]['IGN'] === 'ON' && data[i]['Speed'] > 1) {
                   const externalVoltage = parseFloat(data[i]['External Voltage']);
                   if (!isNaN(externalVoltage)) {
                       sumOfAverageVoltage += externalVoltage;
                       filteredDataLength++;

                   }
               }
           }           
           if (filteredDataLength > 0) {
               avgvoltage = (sumOfAverageVoltage / filteredDataLength).toFixed(2);
           }

            const avgKmByDate = {};
            const timeDifferences = {};

            for (let i = 1; i < data.length; i++) {
              if (data[i].IGN === 'ON' && data[i - 1].IGN === 'ON') {
                const startTime = moment(data[i - 1].date_time);
                const endTime = moment(data[i].date_time);
                const timeDifference = moment.duration(endTime.diff(startTime));
                const formattedTimeDifference = moment.utc(timeDifference.as('milliseconds')).format('HH:mm:ss');
            
                const date = moment(data[i - 1].date_time).format('YYYY-MM-DD');
            
                if (!timeDifferences[date]) {
                  timeDifferences[date] = moment.duration(0, 'milliseconds');
                }
            
                timeDifferences[date] = timeDifferences[date].add(timeDifference);
              }
            }
            
            // Convert the accumulated durations to formatted time differences
            const result5 = Object.entries(timeDifferences).map(([date, duration]) => ({
              date,
              timeDifference: moment.utc(duration.as('milliseconds')).format('HH:mm:ss'),
            }));
            const subtractTime = (timeDifference) => {
              const endTimeOfDay = moment.duration('23:59:59');
              const remainingTime = endTimeOfDay.subtract(timeDifference);
              return moment.utc(remainingTime.as('milliseconds')).format('HH:mm:ss');
            };
            
            // Iterate through the result5 array and subtract timeDifferences from '23:59:59'
            const resultWithSubtraction = result5.map((item) => ({
              date: item.date,
              timeDifference: subtractTime(moment.duration(item.timeDifference)),
            }));
            // Assuming you already have the 'result5' array
      
      // Calculate the total duration
      const totalDuration = result5.reduce((accumulator, item) => {
        const timeParts = item.timeDifference.split(':');
        const duration = moment.duration({
          hours: parseInt(timeParts[0]),
          minutes: parseInt(timeParts[1]),
          seconds: parseInt(timeParts[2]),
        });
        return accumulator.add(duration);
      }, moment.duration(0, 'milliseconds'));
      
      // Calculate the average duration
      const numberOfItems = result5.length;
      const averageDuration = moment.duration(totalDuration.as('milliseconds') / numberOfItems, 'milliseconds');
      
      // Format the average duration as HH:mm:ss
      const formattedAverageDuration = moment.utc(averageDuration.as('milliseconds')).format('HH:mm:ss');
      // Calculate the total duration for resultWithSubtraction
 const totalDurationSubtraction = resultWithSubtraction.reduce((accumulator, item) => {
     const timeParts = item.timeDifference.split(':');
     const duration = moment.duration({
       hours: parseInt(timeParts[0]),
       minutes: parseInt(timeParts[1]),
       seconds: parseInt(timeParts[2]),
     });
     return accumulator.add(duration);
   }, moment.duration(0, 'milliseconds'));
   
   // Calculate the average duration for resultWithSubtraction
   const numberOfItemsSubtraction = resultWithSubtraction.length;
   const averageDurationSubtraction = moment.duration(totalDurationSubtraction.as('milliseconds') / numberOfItemsSubtraction, 'milliseconds');
   const formattedAverageDurationSubtraction = moment.utc(averageDurationSubtraction.as('milliseconds')).format('HH:mm:ss');
data.forEach((row) => {
    if (row['IGN'] !== 'OM') {
        const currentDate = new Date(row['date_time']);
        const currentavgkm = row['Last Distance (meters)'];
        if (currentavgkm !== 'NA') {
            const formattedDate = currentDate.toISOString().split('T')[0];
            if (!avgKmByDate[formattedDate]) {
                avgKmByDate[formattedDate] = [];
            }
            avgKmByDate[formattedDate].push(parseFloat(currentavgkm));

        }
    }
});
const avgKmData = Object.keys(avgKmByDate).map((date) => {
    const kms = avgKmByDate[date];
    const sumKms = kms.reduce((acc, km) => acc + km, 0);
    const averageKm = (sumKms * 0.001);

    return {
        date,
        averageKm,
    };
});

const resultObject = {};
const mainObject   ={};
data.forEach((row) => {
  if (row['IGN']==="ON" & row['External Voltage'] > 40) {
    const currentDate = new Date(row['date_time']);
    const formattedDate = currentDate.toISOString().split('T')[0];
    const hour = currentDate.getHours();
    const currentTime = new Date();
    const options = { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const time24hr = currentDate.toLocaleTimeString('en-US', options);
     
    const Distance = row['Last Distance (meters)']*0.001;
    const concatenatedDateTime = formattedDate + ' ' + hour;
    const concatenatedDate= formattedDate + ' ' + time24hr;
 
    const voltagedata = row['External Voltage'];
    if (!resultObject[concatenatedDateTime]) {
      resultObject[concatenatedDateTime] = Distance;
    } else {
      resultObject[concatenatedDateTime] += Distance;
    }

    if (!mainObject[concatenatedDate]){
      mainObject[concatenatedDate] = voltagedata;
    }
  }
});
const resultArray = Object.entries(resultObject).map(([concatenatedDateTime, Distance]) => ({
  concatenatedDateTime,
  Distance: parseFloat(Distance.toFixed(2)),
}));
const resultArray1 = Object.entries(mainObject).map(([concatenatedDate, voltagedata]) => ({
  concatenatedDate,
  voltagedata
}));


const distancecurve = JSON.stringify(resultArray);
const voltagecurve =JSON.stringify(resultArray1);
const groupedData = {};
data.forEach((row) => {
    if (row['IGN'] !== 'OM') {
        const currentDate = new Date(row['date_time']);
        const formattedDate = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
        const hour = currentDate.getHours();
        if (!groupedData[formattedDate]) {
            groupedData[formattedDate] = {};
        }
        if (!groupedData[formattedDate][hour]) {
            groupedData[formattedDate][hour] = {
                totalKm: 0, 
            };
        }
        // Parse 'Last Distance (meters)' as a float or integer, assuming it's a string
        const distance = parseFloat(row['Last Distance (meters)']);
        groupedData[formattedDate][hour].totalKm += distance;
    }
});
// Calculate the average kilometers for each day and hour
const avgKmByDayAndHour = {};

for (const date in groupedData) {
    avgKmByDayAndHour[date] = [];
    for (let hour = 0; hour < 24; hour++) {
        if (groupedData[date][hour]) {
            const avgKm = (groupedData[date][hour].totalKm / 1000);
            avgKmByDayAndHour[date].push({ hour, avgKm });
        } else {
            avgKmByDayAndHour[date].push({ hour, avgKm: 0 });
        }
    }
}
const avgKmByDayAndHourJSON = JSON.stringify(avgKmByDayAndHour);
    const sumOfAverageKms = avgKmData.reduce((acc, dataPoint) => acc + dataPoint.averageKm, 0);
    const numberOfDays = avgKmData.length ;
    const averageKmPerDay = (sumOfAverageKms / numberOfDays).toFixed(2);
        const maxSpeedByDate = {};
        data.forEach((row) => {
            if (row['IGN'] === 'ON' && row['Speed'] <= 35) {
                const currentDate = new Date(row['date_time']); // Assuming 'date_time' is the date column name
                const currentSpeed = row['Speed'];
                        const formattedDate = currentDate.toISOString().split('T')[0];
                    if (!maxSpeedByDate[formattedDate] || currentSpeed > maxSpeedByDate[formattedDate]) {
                    maxSpeedByDate[formattedDate] = currentSpeed;
                }
            }
        });
        const maxSpeedData = Object.keys(maxSpeedByDate).map((date) => ({
            date,
            speed: maxSpeedByDate[date],
        }));
        const maxSpeedData1 = maxSpeedData;
          const maxSpeedByDate1 = {};
          maxSpeedData1.forEach((entry) => {
            maxSpeedByDate1[entry.date] = entry.speed;
          });
          const maxSpeedDataJSON1 = JSON.stringify(maxSpeedByDate1);
          const maxSpeedDataJSON = JSON.stringify(maxSpeedData);
          const avgSpeedByDate = {};
          data.forEach((row) => {
            if (row['IGN'] === 'ON' && !isNaN(row['Speed']) && row['Speed'] !== 0) {
              const currentDate = new Date(row['date_time']); // Assuming 'date_time' is the date column name
              const currentSpeed = Number(row['Speed']); // Ensure 'Speed' is converted to a number
              const formattedDate = currentDate.toISOString().split('T')[0];
              if (!avgSpeedByDate[formattedDate]) {
                avgSpeedByDate[formattedDate] = [];
              }
              avgSpeedByDate[formattedDate].push(currentSpeed);
            }
          });
          
          const avgSpeedData = Object.keys(avgSpeedByDate).map((date) => {
            const speeds = avgSpeedByDate[date];
            if (speeds.length > 0) {
              const sumSpeed = speeds.reduce((acc, speed) => acc + speed, 0);
              const averageSpeed = (sumSpeed / speeds.length).toFixed(2); 
              return {
                date,
                averageSpeed,
              };
            } else {
              return {
                date,
                averageSpeed: 0,
              };
            }
          });
        const avgSpeedDataJSON = JSON.stringify(avgSpeedData);
        const avgSpeedDataJSON1 = avgSpeedDataJSON;

        const avgSpeedDataArray = JSON.parse(avgSpeedDataJSON1);
        const avgSpeedDataObject = {};
        avgSpeedDataArray.forEach((entry) => {
        avgSpeedDataObject[entry.date] = parseFloat(entry.averageSpeed);
        });
        const avgSpeedDataMergedJSON = JSON.stringify(avgSpeedDataObject);
        const filteredData = formattedDataArray.filter(item => parseFloat(item['External Voltage']) > 40);  
const dateTimes = filteredData.map(entry => entry.date_time);
const distance = filteredData.map(entry => entry['Last Distance (meters)']);
const externalVoltages = filteredData.map(entry => entry['External Voltage']);
const integerList = externalVoltages.map(parseFloat);
const combinedData = dateTimes.map((dateTime, index) => ({
  dateTime,
  integerValue: integerList[index],
  Distance: distance[index]
}));

       const htmlTemplatePath = path.join(__dirname, 'public', 'result.html');
        fs.readFile(htmlTemplatePath, 'utf8', (err, template) => {
            if (err) {
                console.error('Error reading template file:', err);
                return res.status(500).send('Error reading template file');
            }        
                const renderedHtml = template
                .replace('{{selectedTable}}', selectedTable)
                .replace('{{avgvoltage}}', avgvoltage)
                .replace('{{distancecurve}}', distancecurve)
                .replace('{{voltagecurve}}', voltagecurve)
                .replace('{{data}}',JSON.stringify(data))
                .replace('{{formattedAverageDuration}}', formattedAverageDuration)
                .replace('{{formattedAverageDurationSubtraction}}', formattedAverageDurationSubtraction)
                .replace('{{fromDateTimeObj}}', fromDateTimeObj)
                .replace('{{toDateTimeObj}}', toDateTimeObj)
                .replace('{{averageKmPerDay}}', averageKmPerDay)
                .replace('{{filteredSumTimeDifferenceLength}}', filteredSumTimeDifferenceLength)
                .replace('{{maxSpeedDataJSON1}}',maxSpeedDataJSON1)
                .replace('{{avgSpeedDataMergedJSON}}',avgSpeedDataMergedJSON)
                .replace('{{avgKmByDayAndHourJSON}}',avgKmByDayAndHourJSON)
                .replace('{{imeiToObject}}',imeiToObject);
                res.send(renderedHtml);
        });
    });
});
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
