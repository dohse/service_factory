var sinon = require('sinon');

var Service = require('../lib/service');
var ServiceFactory = require('../lib/service_factory');

function createServiceFactory() {
  var serviceFactory = Object.create(ServiceFactory.prototype);
  ServiceFactory.apply(serviceFactory, arguments);

  serviceFactory.stub = {
    error: sinon.stub(),
    starting: sinon.stub(),
    running: sinon.stub(),
    stopping: sinon.stub(),
    stopped: sinon.stub(),
    failed: sinon.stub()
  };
  Object.keys(serviceFactory.stub).forEach(function(event) {
    serviceFactory.on(event, serviceFactory.stub[event]);
  });

  return serviceFactory;
};

function checkEvents(test, stubs, expected) {
  for (var event in expected) {
    test.equal(stubs[event].callCount, expected[event], event);
  }
};

exports['ServiceFactory'] = {
  'starts and stops service': function(test) {
    var service = new Service;

    sinon.stub(service, 'start').yields(null);

    sinon.stub(service, 'stop').yields(null);

    var serviceFactory = createServiceFactory(service);

    serviceFactory.start(function(err) {
      test.ifError(err);

      test.equal(serviceFactory.status, Service.RUNNING);

      test.ok(service.start.calledOnce);

      var stub = serviceFactory.stub;
      test.ok(stub.starting.calledOnce);
      test.ok(stub.running.calledOnce);

      serviceFactory.stop(function(err) {
        test.ifError(err);

        test.equal(serviceFactory.status, Service.STOPPED);

        test.ok(service.stop.calledOnce);

        test.ok(!stub.error.called);
        test.ok(stub.stopping.calledOnce);
        test.ok(stub.stopped.calledOnce);
        test.ok(!stub.failed.called);

        test.done();
      });
    });
  },
  'stops services on error': function(test) {
    var self = this;

    var service1 = new Service;
    var service2 = new Service;

    sinon.stub(service1, 'start').yields(null);

    sinon.stub(service1, 'stop').yields(null);

    sinon.stub(service2, 'start').yields('error');

    sinon.stub(service2, 'stop');

    var serviceFactory = createServiceFactory(service1, service2);

    serviceFactory.start(function(err) {
      test.ok(err instanceof Error);

      test.equal(serviceFactory.status, Service.STOPPED);

      test.ok(service1.start.calledOnce);
      test.ok(service1.stop.calledOnce);
      test.ok(service2.start.calledOnce);
      test.ok(!service2.stop.called);

      checkEvents(test, serviceFactory.stub, {
        starting: 1,
        running: 0,
        stopping: 0,
        stopped: 1,
        failed: 0
      });

      test.done();
    });
  },
  'error during stop() in start()': function(test) {
    var self = this;

    var service1 = new Service;
    var service2 = new Service;

    sinon.stub(service1, 'start').yields(null);

    sinon.stub(service1, 'stop').yields('error');

    sinon.stub(service2, 'start').yields('error');

    sinon.stub(service2, 'stop');

    var serviceFactory = createServiceFactory(service1, service2);

    serviceFactory.start(function(err) {
      test.ok(err instanceof Error);

      test.equal(serviceFactory.status, Service.FAILED);

      test.ok(service1.start.calledOnce);
      test.ok(service1.stop.calledOnce);
      test.ok(service2.start.calledOnce);
      test.ok(!service2.stop.called);

      checkEvents(test, serviceFactory.stub, {
        starting: 1,
        running: 0,
        stopping: 0,
        stopped: 0,
        failed: 1
      });

      test.done();
    });
  },
  'error durign stop()': function(test) {
    var self = this;

    var service1 = new Service;
    var service2 = new Service;

    sinon.stub(service1, 'start').yields(null);
    sinon.stub(service1, 'stop').yields(null);

    sinon.stub(service2, 'start').yields(null);
    sinon.stub(service2, 'stop').yields('error');

    var serviceFactory = createServiceFactory(service1, service2);

    serviceFactory.start(function(err) {
      test.ifError(err);

      test.equal(serviceFactory.status, Service.RUNNING);

      test.ok(service1.start.calledOnce);
      test.ok(service2.start.calledOnce);

      checkEvents(test, serviceFactory.stub, {
        starting: 1,
        running: 1
      });

      serviceFactory.stop(function(err) {
        test.ok(err instanceof Error);

        test.equal(serviceFactory.status, Service.FAILED);

        test.ok(service1.stop.calledOnce);
        test.ok(service2.stop.calledOnce);

        checkEvents(test, serviceFactory.stub, {
          error: 0,
          stopping: 1,
          stopped: 0,
          failed: 1
        });

        test.done();
      });
    });
  }
};
