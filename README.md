# matchmaking
A simple matchmaking service written in node.js

**Basics**

matchmaking is a simple tool that runs a service which matches players according to their ranking. It also tracks basic statistics
which can be used for benchmarking.

**<h3>How to use</h3>**

Clone into local repo, then run **npm install**. that should install all the necessary dependecies.
To see if all is well, run **npm test**. In order to be able to test a relatively large player pool, 
the current FIDE Chess Standard rating player list has been added as mock data and is used by most of the tests.

**<h4>Basic run with mock data</h4>**
Run the app with **node run.js**


Basic parameters are stored in config.js:

* loadCsv = *true* - whether mock data is loaded

* feeder = *true* - csv players will be fed to queue

* feedOneTime = *false* - true inserts all players instantly, false feeds them slowly

* feedNum = *5000* - how many do we queue up per second if feedOneTime = false

* minLeniency = *20* - starting leniency - players can have 20 points rating difference and be paired

* maxLeniency = *300* - maximum leniency - can be reached if a player is waiting for a long time

**<h4>Adding custom players to be matched</h4>**

We use socket.io with event 'playerAdd' to add players to the queue. Example:

`var socket = io.connect('http://localhost:3000', {reconnect: true});`

`socket.emit('playerAdd', {name: 'player 1', rating:'1510'});`



