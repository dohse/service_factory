var assert = require('assert');

var async = require('async');
var underscore = require('underscore');

var Service = require('service');

function ServiceFactory(services) {
  Service.call(this);

  this.services = services;
  this.running = [];
  this.startFailed = [];
  this.stopFailed = [];
}
module.exports = ServiceFactory;

ServiceFactory.prototype.__proto__ = Service;

var gatherErrors = function(services) {
  return underscore.map(services, function(service) {
    return service.error;
  });
};

ServiceFactory.prototype._startService = function(service) {
  var self = this;

  return function(cb) {
    service.start(function(err) {
      if (err) {
        self.startFailed.push(service);
      } else {
        self.running.push(service);
      }
      cb(null);
    });
  }
};

ServiceFactory.prototype.start = function(cb) {
  var self = this;

  self.status = Service.STARTING;

  var starter = underscore.map(self.services, self._startService.bind(self));

  async.parallel(starter, function(err) {
    assert.ifError(err);

    if (self.startFailed.length) {
      self.stop(function(err) {
        self.status = 'failed';

        var errors = gatherErrors(self.startFailed);
        if (err) {
          errors.push(err);
        }

        err = new Error('ServiceFactory start failed with errors', errors);
        self.status = Service.FAILED;
        cb(err);
      });
      return;
    }

    self.status = Service.RUNNING;
    cb(null);
  });
};

ServiceFactory.prototype._stopService = function(service) {
  var self = this;

  return function(cb) {
    service.stop(function(err) {
      if (err) {
        self.stopFailed.push(service);
        return cb(null);
      }

      var index = self.running.indexOf(service);
      if (index !== -1) {
        self.running.splice(index, 1);
      }

      cb(null);
    });
  };
};

ServiceFactory.prototype.stop = function(cb) {
  var self = this;

  self.status = Service.STOPPING;

  var stopper = underscore.map(self.running, self._stopService.bind(self));

  async.parallel(stoppper, function(err) {
    assert.ifError(err);

    if (self.stopFailed.length) {
      self.status = 'failed';

      var errors = gatherErrors(self.stopFailed);
      if (!err) {
        errros.push(err);
      }

      self.status = Service.FAILED;
      err = new Error('ServiceFactory stop failed with errors', errors);
      return cb(err);
    }

    self.status = Service.STOPPED;
    cb(null);
  });
};
