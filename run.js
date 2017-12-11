var app = require('./app.js');

app();

/** Examples: */
// app({loadCsv: false}); // to only start the service without mock data
// app({feedNum: 1}); // feeds a single player from mock data each second. good to test low volume
// app({feedOneTime: true}); // feeds whole csv instantly
// app({minLeniency: 100, maxLeniency: 1000}); // makes matching more flexible
// app({feedNum: 10, verbose: true}); // to see who is paired
