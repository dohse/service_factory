var assert = require('assert');
var util = require('util');

var async = require('async');
var underscore = require('underscore');

var Service = require('./service');

function ServiceFactory(services) {
  Service.call(this);

  this.services = arguments;
  this.running = [];
  this.startFailed = [];
  this.stopFailed = [];
}
module.exports = ServiceFactory;
util.inherits(ServiceFactory, Service);

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

  if (self.status !== Service.NEW) {
    return cb(new Error('Service not new'));
  }
  self.changeStatus(Service.STARTING);

  var starter = underscore.map(self.services, self._startService.bind(self));

  async.parallel(starter, function(err) {
    assert.ifError(err);

    if (self.startFailed.length) {
      stop(self, function(err) {
        var errors = gatherErrors(self.startFailed);
        if (err) {
          errors.push(err);
        }

        self.changeStatus(err ? Service.FAILED : Service.STOPPED);
        err = new Error('ServiceFactory start failed with errors', errors);
        err.errors = errors;
        cb(err);
      });
      return;
    }

    self.changeStatus(Service.RUNNING);
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

function stop(self, cb) {
  var stopper = underscore.map(self.running, self._stopService.bind(self));

  async.parallel(stopper, function(err) {
    assert.ifError(err);

    if (self.stopFailed.length) {
      var errors = gatherErrors(self.stopFailed);

      err = new Error('ServiceFactory stop failed with errors', errors);
      return cb(err);
    }

    cb(null);
  });
};

ServiceFactory.prototype.stop = function(cb) {
  var self = this;

  if (self.status !== Service.RUNNING) {
    return cb(new Error('ServiceFactory failed with errors'));
  }
  self.changeStatus(Service.STOPPING);

  stop(self, function(err) {
    if (err) {
      self.changeStatus(Service.FAILED);
      return cb(err);
    }

    self.changeStatus(Service.STOPPED);
    cb(null);
  });
};
