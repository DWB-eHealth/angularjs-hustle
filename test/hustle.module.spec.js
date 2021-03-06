describe("hustle angular provider", function() {
    var hustle, rootScope, q, app, interceptor, times = 0, comparator, stopConsumer;

    beforeEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 25000;
        stopConsumer = null;

        if (app) return;
        comparator = jasmine.createSpy("comparator").and.callFake(function (a,b) {
            return a === b;
        });
        app = angular.module("testModule", ["hustle"]);
        app.config(["$hustleProvider",
            function($hustleProvider) {
                $hustleProvider.init("hustle", 1, ["testTube", "testTube2", "testTubeForUnique"], comparator);
            }
        ]);

        var $injector = angular.bootstrap(document.querySelector('head'), ['testModule']);

        q = $injector.get('$q');
        rootScope = $injector.get('$rootScope');
        hustle = $injector.get('$hustle');

        interceptor = {
            "onSuccess": jasmine.createSpy("onSuccess"),
            "onFailure": jasmine.createSpy("onFailure"),
            "shouldRetry": jasmine.createSpy("shouldRetry"),
            "onPublish": jasmine.createSpy("onPublish")
        };

        hustle.registerInterceptor(interceptor);

    });

    var publish = function(n, tube) {
        return function() {
            return hustle.publish(n, tube);
        };
    };

    it("should consume messages one at a time in order", function(done) {
        var currentIndex = 1;
        var numberOfTestCases = 10;

        var someBlockingCall = function(defered) {
            setTimeout(function() {
                defered.resolve();
            }, 100);
        };

        var consumerFunction = function(message) {
            var defered = q.defer();
            expect(message.data).toEqual(currentIndex);
            if (currentIndex >= numberOfTestCases) {
                stopConsumer();
                done();
            }
            currentIndex++;
            someBlockingCall(defered);
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube").then(function(consumer) {
            stopConsumer = consumer.stop;
            var p = publish(1, "testTube")();
            for (var i = 2; i <= numberOfTestCases; i++) {
                p = p.then(publish(i, "testTube"));
            }
            p.then(consumer.start);
        });
    });

    it("should publish only unique jobs", function(done) {
        var tubeName = "testTubeForUnique";
        var publishOnce = function(n, tube) {
            return function() {
                return hustle.publishOnce(n, tube);
            };
        };
        var checkCount = function () {
            hustle.getCount(tubeName).then(function (count) {
                expect(count).toEqual(2);
                expect(comparator).toHaveBeenCalled();
                done();
            });
        };

        publishOnce("job4", tubeName)()
            .then(publishOnce("job4", tubeName))
            .then(publishOnce("job5", tubeName))
            .then(checkCount);
    });

    it("should call onSuccess if the interceptor is registered", function(done) {

        var someBlockingCall = function(defered) {
            setTimeout(function() {
                defered.resolve();
            }, 100);
        };

        var consumerFunction = function(message) {
            var defered = q.defer();
            someBlockingCall(defered);
            if (message.data === "end") {
                expect(interceptor.onSuccess).toHaveBeenCalled();
                stopConsumer();
                done();
            }
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube2")
            .then(function(consumer) {
                stopConsumer = consumer.stop;
                publish("foo", "testTube2")()
                    .then(publish("end", "testTube2"));
                consumer.start();
            });
    });

    it("should call onFailure if the interceptor is registered", function(done) {

        var someBlockingCall = function(defered) {
            setTimeout(function() {
                defered.reject();
            }, 100);
        };

        var consumerFunction = function(message) {
            var defered = q.defer();
            someBlockingCall(defered);
            if (message.data === "end") {
                expect(interceptor.onFailure).toHaveBeenCalled();
                stopConsumer();
                done();
            }
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube2")
            .then(function(consumer) {
                stopConsumer = consumer.stop;
                publish("foo", "testTube2")()
                    .then(publish("end", "testTube2"));
                consumer.start();
            });
    });

    it("should call shouldRetry if the interceptor is registered and shouldRetry is defined", function(done) {

        var someBlockingCall = function(defered) {
            setTimeout(function() {
                defered.reject();
            }, 100);
        };

        var consumerFunction = function(message) {
            var defered = q.defer();
            someBlockingCall(defered);
            if (message.data === "end") {
                expect(interceptor.shouldRetry).toHaveBeenCalled();
                done();
                stopConsumer();
            }
            return defered.promise;
        };

        interceptor.shouldRetry = jasmine.createSpy("shouldRetry");
        hustle.registerInterceptor(interceptor);

        hustle.registerConsumer(consumerFunction, "testTube2").then(function(consumer) {
            stopConsumer = consumer.stop;
            publish("foo", "testTube2")().then(publish("end", "testTube2"));
            consumer.start();
        });
    });

    it("should call onPublish when a new job is added to the queue", function(done) {
        var consumerFunction = function() {};

        hustle.registerConsumer(consumerFunction, "testTube2").then(function() {
            publish("foo", "testTube2");

            expect(interceptor.onPublish).toHaveBeenCalled();
            done();
        });
    });

    it("should call onReserve when a new job is getting processed", function(done) {
        var consumerFunction = function() {
            expect(interceptor.onReserve).toHaveBeenCalled();
            stopConsumer();
            done();
        };

        interceptor.onReserve = jasmine.createSpy("onReserve");
        hustle.registerInterceptor(interceptor);

        hustle.registerConsumer(consumerFunction, "testTube2").then(function(consumer) {
            stopConsumer = consumer.stop;
            publish("foo", "testTube2")();
            consumer.start();
        });
    });
});
