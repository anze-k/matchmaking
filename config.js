module.exports = () => {
  return {}
};

/** Examples: */
// {loadCsv: false}; // to only start the service without mock data
// {feedNum: 1}; // feeds a single player from mock data each second. good to test low volume
// {feedOneTime: true}; // feeds whole csv instantly
// {minLeniency: 100, maxLeniency: 1000}; // makes matching more flexible
// {feedNum: 10, verbose: true}; // to see who is paired
