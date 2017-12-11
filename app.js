var csv = require("fast-csv");
var io = require('socket.io')();

/** queue related objects: */
var playerPool = []; // filled from CSV mock data
var queue = []; // queue is fed from playerPool
var q1 = []; // q1 and q2 are matching queues
var q2 = [];
var paired = []; // an array of already paired players

/** for feeder */
var loadCsv = true; // whether mock data is loaded
var feederFile = "mockdata/standard_rating_list.csv"; // csv of players
var feeder = true; // csv players will be fed to queue
var feedOneTime = false; // true - insert all players instantly, false - feed them slowly
var feedTimer; // timer for feeding (defaults to 1 second)
var feedNum = 5000; // how many do we queue up per second if feedOneTime = false

var minLeniency = 20; // starting leniency - players can have 20 points rating difference and be paired
var maxLeniency = 300; // maximum leniency - can be reached if a player is waiting for a long time

/** for stats */
var maxDifference = 0;
var maxTime = 0;
var matchedPlayers = 0;
var matchingStart = Date.now();

var verbose = false;
var exit = false;

io.on('connection', (client) => {
  client.on('playerAdd', (msg) => {
    var name = msg.name;
    var rating = msg.rating;
    var humanPerson = new Person(client.id, name, parseInt(rating), true);
    humanPerson.timestamp = Date.now();
    queue.push(humanPerson);
  });

  client.on('done', (msg) => {
    exit = true;
  });
});


io.listen(3000);

module.exports = (options) => {
  if (options) {
    if (options.hasOwnProperty('loadCsv')) loadCsv = options.loadCsv;
    if (options.hasOwnProperty('feeder')) feeder = options.feeder;
    if (options.hasOwnProperty('feedOneTime')) feedOneTime = options.feedOneTime;
    if (options.hasOwnProperty('feedNum')) feedNum = options.feedNum;
    if (options.hasOwnProperty('minLeniency')) minLeniency = options.minLeniency;
    if (options.hasOwnProperty('maxLeniency')) maxLeniency = options.maxLeniency;
    if (options.hasOwnProperty('verbose')) verbose = options.verbose;
  }

  if (loadCsv) {
    csv.fromPath(feederFile, {delimiter: '|'}).on("data", (data) => {
       var person = new Person(data[0], data[1], data[8]);
       playerPool.push(person);
     }).on("end", () => {
       //start feeding before calculating
       if (feeder) {
         if (!feedOneTime) feedTimer = setInterval(feed, 1000);
         else feed(playerPool.length);
       }
    });
  }
  setTimeout(matchRankings, 2000);
}

/**
 * Entities in the queue are Persons.
 * @param {String} id - if nonhuman this is the id from csv, otherwise socketId
 * @param {String} name
 * @param {Number} rating
 * @param {Boolean} human - boolean whether Person has to receive messages about pairing
 */
function Person(id, name, rating, human) {
   this.id = id;
   this.name = name;
   this.rating = parseInt(rating);
   this.human = human || false;
}

/**
 * Overlay function that prepares queues and matches players.
 */
var matchRankings = async () => {
  while (true) {
    if (exit) {
      reset();
      break;
    } if (queue.length >= 2) {
      prepareQueues();
      matchQueues();
    }
    printStats();
    await sleep(1000);
  }
  exit = false;
}

/**
 * Feeds the queue with entries from csv.
 */
var feed = (feedSize) => {
  if (playerPool.length == 0) {
    clearInterval(feedTimer);
    //return;
  }

  for (var i = 0; i < (feedSize ? feedSize : feedNum) && i < playerPool.length; i++) {
    playerPool[i].timestamp = Date.now();
    queue.push(playerPool[i]);
  }
  console.log("-> Moved " + (feedSize ? feedSize : feedNum) + " people from pool to queue");
  playerPool.splice(0, feedSize ? feedSize : feedNum);
}

/**
 * Matches all players in the queue. Those that are not matched
 * are put back into the queue to be matched in the next run.
 */
var matchQueues = () => {
  let i = 0;
  let j = 0;
  let tempPaired = 0;
  while (i < q1.length && j < q2.length) {
    var player = q1[i];
    var player2 = q2[j];

    if (player.rating == player2.rating) { //instant match. don't bother with leniency
      pair(player, player2);
      i++; j++; tempPaired += 2;
      continue;
    }

    var leniency = calcLeniency(player, maxLeniency) + calcLeniency(player2, maxLeniency) + minLeniency;
    var lowerLimit = player.rating - leniency;
    var highLimit = player.rating + leniency;

    if (player2.rating <= highLimit &&  player2.rating >= lowerLimit) {
      pair(player, player2);
      i++; j++; tempPaired += 2;
    } else if (player2.rating < lowerLimit) {
      pushPlayerToQueue(player); i++;
    } else if (player2.rating > highLimit) {
      pushPlayerToQueue(player2); j++;
    }
  }

  while (i < q1.length) {
    pushPlayerToQueue(q1[i]); i++;
  }

  while (j < q2.length) {
    pushPlayerToQueue(q2[j]); j++;
  }

  q1 = [];
  q2 = [];

  console.log("-> Paired " + tempPaired + " players.")
}

var pair = (player, player2) => {
  if (player.human) io.to(player.id).emit('paired', [player, player2]);
  if (player2.human) io.to(player2.id).emit('paired', [player, player2]);
  if (verbose) console.log("-----> Found a pair name: " + player.name + " ( " + player.rating + " ) vs name: " + player2.name + "( " + player2.rating + " )");
  paired.push(player, player2);
  if (Math.abs(player2.rating - player.rating) > maxDifference) maxDifference = Math.abs(player2.rating - player.rating);
  let time = Date.now();
  if ((time - player.timestamp) / 1000 > maxTime) maxTime = (time - player.timestamp) / 1000;
  if ((time - player2.timestamp) / 1000 > maxTime) maxTime = (time - player2.timestamp) / 1000;
}

var pushPlayerToQueue = (player) => {
  console.log("-> Player pushed back to queue - name: " + player.name + " ( " + player.rating + " )");
  queue.push(player);
}


/**
 * Calculates leniency. If the player has been in the queue
 * for long, we are more forgiving with rating matching.
 * @param {Player} player
 * @param {Number} maxLeniency
 * @return {Number} leniency
 */
var calcLeniency = (player, maxLeniency) => {
  var leniency = 0;
  var time = (Date.now() - player.timestamp) / 1000; //seconds
  if (time > 30) {
    leniency = time - 30;
    if (leniency > maxLeniency) leniency = maxLeniency;
  }
  return leniency;
}

var sleep = (ms) => {
  return new Promise(resolve=>{
    setTimeout(resolve,ms)
  })
}


/**
 * For optimised matching, we divide the sorted main queue into 2 queues
 * which are filled alternately. Main queue is emptied so we don't get duplicates.
 */
var prepareQueues = () => {
  queue.sort(function (a, b) {
    return b.rating - a.rating;
  });

  for (var i = 0; i < queue.length; i++) {
    if (i % 2 == 0) q1.push(queue[i]);
    else q2.push(queue[i]);
  }
  queue = [];
}

var printStats = () => {
  console.log("---------- STATS ---------");
  console.log("Pool size: " + playerPool.length);
  console.log("Queue size: " + (queue.length + q1.length + q2.length));
  console.log("Max matched rating difference: " + maxDifference);
  console.log("Max player waiting time: " + maxTime);
  console.log("Matching speed: " + paired.length / ((Date.now()- matchingStart)/1000) + " players / second");
  console.log("Matched players: " + paired.length);
  console.log("Total: " + (playerPool.length + paired.length + queue.length));
  console.log("--------------------------");
}

var reset = () => {
  if (feedTimer) clearInterval(feedTimer);
  playerPool = [], queue = [], q1 = [], q2 = [], paired = [];
  loadCsv = true, feederFile = "mockdata/standard_rating_list.csv", feeder = true, feedOneTime = false, feedNum = 5000, minLeniency = 20, maxLeniency = 300;
  maxDifference = 0, maxTime = 0, matchedPlayers = 0, matchingStart = Date.now();
  exit = false;
}
