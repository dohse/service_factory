var events = events.EventEmitter;

function Service() {
    events.EventEmitter.call(this);

    this.error = null;
    this.status = Service.NEW;
};
module.exports = Service;

Serivce.prototype.__proto__ = events.EventEmitter;
Service.prototype.start = function(cb) {};
Service.prototype.stop  = function(cb) {};
Service.prototpye.get   = function() {};

// Cycle is new, starting, running, stopping, stopped, failed
Service.NEW      = 'new';
Service.STARTING = 'starting';
Service.RUNNING  = 'running';
Service.STOPPING = 'stopping';
Service.STOPPED  = 'stopped';
Service.FAILED   = 'failed';
