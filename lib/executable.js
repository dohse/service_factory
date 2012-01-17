var assert = require('assert');
var childProcess = require('child_process');
var util = require('util');

var async = require('async');

var Service = require('service');
var Poller = require('poller');

function Executable(cmd, args, port) {
  Service.call(this);

  this.cmd = cmd;
  this.args = args;

  this.poller = new Poller([ port ]);
  this.process = null;
};
module.exports = Executable;

Executable.prototype.__proto__ = Service;

Executable.prototype.start = function(cbStart) {
  var self = this;

  self.status = Service.STARTING;

  async.waterfall([
    function(cb) {
      self.poller.poll(function(err) {
        cb(err ? null : new Error('Process already running'));
      });
    }, function(cb) {
      self.process = childProcess.spawn(self.cmd, self.args);

      var exitCb = function(code, signal) {
        self.poller.cancel(new Error(
          util.format('Process exited code: %d signal: %s', code, signal)
        ));
      };
      self.process.on('exit', exitCb);

      self.poller.wait(function(err) {
        self.process.removeListener('exit', exitCb);

        cb(err);
      });
    }
  ], function(err) {
    if (err) {
      self.status = Service.FAILED;
      return cbStart(err);
    }

    self.process.on('exit', function(code, signal) {
      self.emit('error', new Error(util.format(
        'Process exited unexpectetly code: %d signal: %s', code, signal
      )));
    });

    self.status = Service.RUNNING;
    cbStart(null);
  });
};

Executable.prototype.stop = function(cbStop) {
  var self = this;

  self.status = Service.STOPPING;

  async.waterfall([
    function(cb) {
      var killTimeout = setTimeout(function() {
        self.emit('warn', 'Process not exited after 15s - Sending KILL signal');
        self.process.kill('SIGKILL');
      }, 15000);

      self.process.on('exit', function(code, signal) {
        self.emit('info',
          util.format('Process exited code: %d signal: %s', code, signal)
        );
        clearTimeout(killTimeout);

        cb(null);
      });

      self.process.kill();
    }, function(cb) {
      self.poller.poll(function(err) {
        cb(err ? null :
          new Error('Process stopped, but port still open. Sounds spanish')
        );
      });
    }
  ], function(err) {
    if (err) {
      self.status = Service.FAILED;
      return cbStop(err);
    }

    self.status = Service.STOPPED;
    cbStart(null);
  });
};

Executeable.prototype.get = function() {
  return this.process;
};
