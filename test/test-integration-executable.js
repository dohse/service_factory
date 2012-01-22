var async = require('async');
var sinon = require('sinon');

var Executable = require('../lib/executable');

exports['Executable'] = {
  setUp: function(cb) {
    cb(null);
  },
  'start() and stop() works': function(test) {
    var self = this;

    self.nc = new Executable('/bin/nc', [ '-lk', '1337' ], 1337);

    var stub = {
      error: sinon.stub(),
      running: sinon.stub(),
      stopped: sinon.stub()
    };

    self.nc.on('error', stub.error);
    self.nc.on('running', stub.running);
    self.nc.on('stopped', stub.stopped);

    self.nc.start(function(err) {
      test.ifError(err);
      if (err) {
        test.done();
      }

      self.nc.stop(function(err) {
        test.ifError(err);

        test.ok(!stub.error.called);
        test.ok(stub.running.calledOnce);
        test.ok(stub.stopped.calledOnce);

        test.done();
      });
    });
  },
  'early exit fails': function(test) {
    var self = this;

    self.nc = new Executable('/bin/true', [], 1337);

    self.nc.start(function(err) {
      test.ok(err instanceof Error);

      test.done();
    });
  },
};
