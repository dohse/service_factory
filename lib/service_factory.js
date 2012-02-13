var assert = require('assert');
var util = require('util');

var async = require('async');

var Service = require('./service');

function Handle(service) {
  var self = this instanceof Handle ? this : Object.create(Handle.prototype);

  self.service = service;
  self.error = null;

  return self;
}

function ServiceFactory(services) {
  Service.call(this);

  this.services = Array.isArray(services) ? services :
      Array.prototype.slice.call(arguments);

  this._handles = this.services.map(Handle);

  this.running = [];
  this.startFailed = [];
  this.stopFailed = [];
}
module.exports = ServiceFactory;
util.inherits(ServiceFactory, Service);

function gatherErrors(handles) {
  return handles.map(function(handle) {
    return handle.error;
  });
}

ServiceFactory.prototype._startService = function(handle) {
  var self = this;

  return function(cb) {
    handle.service.start(function(err) {
      if (err) {
        handle.error = err;
      }

      self[err ? 'startFailed' : 'running'].push(handle);

      cb(null);
    });
  };
};

function stop(self, cb) {
  var stopper = self.running.map(self._stopService.bind(self));

  async.parallel(stopper, function(err) {
    assert.ifError(err);

    if (self.stopFailed.length) {
      var errors = gatherErrors(self.stopFailed);

      err = new Error('ServiceFactory stop failed with errors', errors);
      return cb(err);
    }

    cb(null);
  });
}

ServiceFactory.prototype.start = function(cb) {
  var self = this;

  if (self.status !== Service.NEW) {
    return cb(new Error('Service not new'));
  }
  self.changeStatus(Service.STARTING);

  var starter = self._handles.map(self._startService.bind(self));

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

ServiceFactory.prototype._stopService = function(handle) {
  var self = this;

  return function(cb) {
    handle.service.stop(function(err) {
      if (err) {
        self.stopFailed.push(handle);
        return cb(null);
      }

      var index = self.running.indexOf(handle);
      if (index !== -1) {
        self.running.splice(index, 1);
      }

      cb(null);
    });
  };
};

ServiceFactory.prototype.stop = function(cb) {
  var self = this;

  if (self.status !== Service.RUNNING) {
    return cb(new Error('ServiceFactory is not RUNNING'));
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
