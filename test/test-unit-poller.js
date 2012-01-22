var net = require('net');

var Poller = require('../lib/poller');

var sinon = require('sinon');


exports.setUp = function(cb) {
  this.socket = new net.Socket;
  sinon.stub(this.socket, 'on');
  sinon.stub(this.socket, 'connect');
  sinon.stub(this.socket, 'destroy');

  sinon.stub(net, 'Socket');
  net.Socket.returns(this.socket);

  this.poller = new Poller([ 1337 ]);

  cb(null);
};

exports.tearDown = function(cb) {
  net.Socket.restore();
  cb(null);
};

var filterOn = function(event) {
  var arr = [].slice.call(arguments, 1);
  return function(curEvent, handler) {
    if (curEvent === event) {
      process.nextTick(function() {
        handler.apply(null, arr);
      });
    }
  };
};

var U;

exports['Poller.poll()'] = U = {};

U['with successfull connect'] = function(test) {
  var self = this;

  var socket = self.socket;
  socket.on = sinon.spy(filterOn('connect'));

  self.poller.poll(function(err) {
    test.ifError(err);
    test.ok(socket.destroy.calledOnce);

    test.equals(self.poller.socket, null);

    test.done();
  });

  test.ok(socket.on.calledWith('connect'));
  test.ok(socket.on.calledWith('error'));

  test.ok(socket.connect.calledOnce);
  test.ok(socket.connect.calledWith(1337));
};

U['with failed connect'] = function(test) {
  var self = this;

  var socket = self.socket;
  var error = new Error('Dummy error');
  socket.on = sinon.spy(filterOn('error', error));

  self.poller.poll(function(err) {
    test.equal(err, error);

    test.done();
  });
};

exports['Poller.wait()'] = U = {};

U['returns'] = function(test) {
  var self = this;

  var socket = self.socket;
  socket.on = sinon.spy(filterOn('connect'));

  self.poller.wait(function(err) {
    test.ifError(err);

    test.done();
  });
};

U['is cancelable'] = function(test) {
  var self = this;

  var socket = self.socket;
  socket.on = sinon.spy(filterOn('error'));

  self.poller.wait(function(err) {
    test.equal(err, 'error');

    test.done();
  });

  self.poller.cancel('error');
};

U['works with multiple callbacks'] = function(test) {
  var self = this;

  var socket = self.socket;
  socket.on = sinon.spy(filterOn('connect'));

  var firstCall = sinon.stub();
  self.poller.wait(firstCall);

  self.poller.wait(function(err) {
    test.ifError(err);

    test.ok(firstCall.calledOnce);
    test.ok(firstCall.calledWith());

    test.done();
  });
};

var onEmitErrorEmitConnect = function() {
  var connectSeen = 0;
  return function(event, handler) {
    if (event === 'connect') {
      connectSeen++;
    }
    if (connectSeen < 2 && event === 'error') {
      process.nextTick(function() {
        handler(new Error('Dummy error'));
      });
    } else if (connectSeen >= 2 && event === 'connect') {
      process.nextTick(handler);
    }
  };
};

U['works with delay'] = function(test) {
  var self = this;

  var socket = self.socket;
  socket.on = sinon.spy(onEmitErrorEmitConnect());

  self.poller.wait(function(err) {
    test.ifError(err);

    test.equal(socket.on.callCount, 4);

    test.done();
  });
};

