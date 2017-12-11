var io = require('socket.io-client');
var mocha = require('mocha');
var expect = require('chai').expect;
var socket = io.connect('http://localhost:3000', {reconnect: true});
var app = require('../app.js');;

beforeEach(function() {
  socket.off('paired');
});

describe("Match 2 equal players", function() {
  it("matches 2 equal players", function(done) {
    this.timeout(10000);
    var options = { "feeder": false, "loadCsv": false };
    app(options);
    socket.emit('playerAdd', {name: 'player 1', rating:'1510'});
    socket.emit('playerAdd', {name: 'player 2', rating:'1500'});
    var i = 0;
    socket.on('paired', (data) => {
      printPairing(data);
      expect(data[0].name).to.equal("player 1");
      expect(data[1].name).to.equal("player 2");
      i++;

      if (i == 2) {
        socket.emit('done');
        done(); // we receive 2 messages because they are created with same socket id.
      }
    });
  });
});

describe("Match a randomly skilled player", function() {
  it("matches a randomly skilled player among mock data csv players", function(done) {
    this.timeout(100000);
    var options = { "feeder": true, "feederOneTime": false, "loadCsv": true };
    app(options);
    setTimeout(function () {
      socket.emit('playerAdd', {name: 'player 1', rating: Math.floor(Math.random() * (1800)) + 1000});
    }, 2000);

    socket.on('paired', (data) => {
      printPairing(data);
      var names = [data[0].name, data[1].name];
      expect(names).to.be.an('array').that.includes('player 1');
      socket.emit('done');
      done();
    });
  });
});

describe("Match 10 randomly skilled players interval", function() {
  it("matches 10 randomly skilled players among mock data csv players", function(done) {
    this.timeout(100000);
    var options = { "feeder": true, "feederOneTime": false, "loadCsv": true };
    app(options);
    var i = 0;
    var timer = setInterval(function () {
      i++;
      if (i > 9) clearInterval(timer);
      socket.emit('playerAdd', {name: 'player 1', rating: Math.floor(Math.random() * (1800)) + 1000});
    }, 3000);

    var j = 1;
    socket.on('paired', (data) => {
      printPairing(data);
      var names = [data[0].name, data[1].name];
      expect(names).to.be.an('array').that.includes('player 1');
      if (j == 10) {
        socket.emit('done');
        done();
      }
      j++;
    });
  });
});

describe("Match 10 randomly skilled players without interval", function() {
  it("matches 10 randomly skilled players among mock data csv players", function(done) {
    this.timeout(100000);
    var options = { "feeder": true, "feederOneTime": false, "loadCsv": true };
    app(options);
    setTimeout(() => {
      for (var i = 0; i < 10; i++) {
        socket.emit('playerAdd', {name: 'player 1', rating: Math.floor(Math.random() * (1800)) + 1000});
      }
    }, 5000);

    var j = 1;
    pairedTime = 0;
    socket.on('paired', (data) => {
      printPairing(data);
      var names = [data[0].name, data[1].name];
      expect(names).to.be.an('array').that.includes('player 1');
      if (j == 10) {
        socket.emit('done');
        done();
      }
      j++;
    });
  });
});


var printPairing = (data) => {
  console.log('----> Paired! ' + data[0].name + " (" + data[0].rating + ") vs " + data[1].name + " (" + data[1].rating + ")" );
  console.log('----> ' + data[0].name + " waited for " + (Date.now() - data[0].timestamp)/1000 + " seconds, " + data[1].name + " waited for " + (Date.now() - data[1].timestamp)/1000 + " seconds.");
}
