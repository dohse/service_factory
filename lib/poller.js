var assert = require('assert');

var net = require('net');

function Poller(connectParameter) {
  this.connectParameter = connectParameter;

  this.timeout = null;
  this.waiting = [];
};
module.exports = Poller;

Poller.prototype.wait = function(cb) {
  var self = this;

  if (self.waiting.length) {
    self.waiting.push(cb);
    return;
  }

  self.waiting.push(cb);

  var doPoll = function() {
    self.poll(function(err) {
      if (err) {
        self.timeout = setTimeout(doPoll, 1000);
        return;
      }

      self.waiting.forEach(function(waitingCb) {
        waitingCb(null);
      });
      self.waiting = [];
    });
  };
  doPoll();
};

Poller.prototype.poll = function(cb) {
  var self = this;

  var socket = new net.Socket;

  socket.on('connect', function() {
    socket.destroy();
    socket = null;

    cb(null);
  });

  socket.on('error', function(err) {
    cb(err);
  });

  socket.connect.apply(socket, self.connectParameter);
};

Poller.prototype.cancel = function(err) {
  clearTimeout(this.timeout);
  this.waiting.forEach(function(cb) {
    cb(new Error('Poller canceled', err));
  });
  this.waiting = [];
};
