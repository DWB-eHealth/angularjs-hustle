describe("hustle angular provider", function() {
    var hustle, rootScope, q, app, interceptor, times = 0, comparator;

    beforeEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 25000;
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
            "shouldRetry": undefined
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
            if (currentIndex >= numberOfTestCases)
                done();
            currentIndex++;
            someBlockingCall(defered);
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube").then(function(consumer) {

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
                done();
            }
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube2")
            .then(function(consumer) {
                publish("foo", "testTube2")()
                    .then(publish("end", "testTube2"));
                consumer.start();
            });
    });

    it("should call onFailure if the interceptor is registered and shouldRetry is undefined", function(done) {

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
                done();
            }
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube2")
            .then(function(consumer) {
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
            }
            return defered.promise;
        };

        interceptor.shouldRetry = jasmine.createSpy("shouldRetry");
        hustle.registerInterceptor(interceptor);

        hustle.registerConsumer(consumerFunction, "testTube2").then(function(consumer) {
            publish("foo", "testTube2")().then(publish("end", "testTube2"));
            consumer.start();
        });
    });
});
