var assert = require('assert');
var childProcess = require('child_process');
var util = require('util');

var async = require('async');

var Service = require('./service');
var Poller = require('./poller');

function Executable(cmd, args, port) {
  Service.call(this);

  this.cmd = cmd;
  this.args = args;

  this.poller = new Poller([ port ]);
  this.process = null;
  this.exitCb = function() {};
};
module.exports = Executable;

util.inherits(Executable, Service);

Executable.prototype.start = function(cbStart) {
  var self = this;

  if (self.status !== Service.NEW) {
    return cbStart(new Error('Executable is not new'));
  }
  self.changeStatus(Service.STARTING);

  async.waterfall([
    function(cb) {
      self.poller.poll(function(err) {
        cb(err ? null : new Error('Process already running'));
      });
    }, function(cb) {
      self.process = childProcess.spawn(self.cmd, self.args);

      self.process.on('exit', function(code, signal) {
        self.exitCb(code, signal);
      });

      self.exitCb = function(code, signal) {
        self.poller.cancel(new Error(
          util.format('Process exited code: %d signal: %s', code, signal)
        ));
      };

      self.poller.wait(cb);
    }
  ], function(err) {
    if (err) {
      self.changeStatus(Service.FAILED);
      return cbStart(err);
    }

    self.exitCb = function(code, signal) {
      self.emit('error', new Error(util.format(
        'Process exited unexpectetly code: %d signal: %s', code, signal
      )));
      self.changeStatus(Service.FAILED);
    };

    self.changeStatus(Service.RUNNING);
    cbStart(null);
  });
};

Executable.prototype.stop = function(cbStop) {
  var self = this;

  if (self.status !== Service.RUNNING) {
    return cbStop(new Error('Executable is not running'));
  }
  self.changeStatus(Service.STOPPING);

  async.waterfall([
    function(cb) {
      var killTimeout = setTimeout(function() {
        self.emit('warn', 'Process not exited after 15s - Sending KILL signal');
        self.process.kill('SIGKILL');
      }, 15000);

      self.exitCb = function(code, signal) {
        self.emit('info',
          util.format('Process exited code: %d signal: %s', code, signal)
        );
        clearTimeout(killTimeout);

        cb(null);
      };

      self.process.kill();
    }, function(cb) {
      self.poller.poll(function(err) {
        if (!err) {
          cb(new Error('Process stopped, but port still open. Sounds spanish'));
        } else {
          cb(null);
        }
      });
    }
  ], function(err) {
    if (err) {
      self.changeStatus(Service.FAILED);
      return cbStop(err);
    }

    self.changeStatus(Service.STOPPED);
    cbStop(null);
  });
};

Executable.prototype.get = function() {
  return this.process;
};
