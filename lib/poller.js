var assert = require('assert');

var events = require('events');
var net = require('net');

function Poller(connectParameter) {
  events.EventEmitter.call(this);
  this.connectParameter = connectParameter;

  this.socket = null;
  this.timeout = null;

  // Bind _repoll to this instance
  this._repoll = this._repoll.bind(this);
};
module.exports = Poller;

Poller.prototype._repoll = function() {
  this.timeout = setTimeout(this.poll.bind(this), 1000);
};

Poller.prototype.wait = function() {
  if (this.socket || this.timeout) {
    return;
  }

  this.on('error', this._repoll);

  this.poll();
};

Poller.prototype.poll = function() {
  var self = this;

  self.timeout = null;

  self.socket = new net.Socket;

  socket.on('connect', function() {
    self.socket.destroy();
    self.socket = null;

    self.removeListener('error', self._repoll);

    self.emit('connect');
  });

  socket.on('error', function(err) {
    self.emit('error', err);
  });

  self.socket.connect.apply(socket, self.connectParameter);
};

Poller.prototype.cancel = function() {
  clearTimeout(this.timeout);
  this.socket.destroy();
};
