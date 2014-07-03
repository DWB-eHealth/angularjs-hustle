describe("hustle angular provider", function() {
    var hustle, rootScope, q, app, failureStrategy, times = 0;

    var failureStrategy = jasmine.createSpy();

    beforeEach(function() {
        if (app) return;
        app = angular.module("testModule", ["hustle"]);
        app.config(["$hustleProvider",
            function($hustleProvider) {
                $hustleProvider.init("hustle", 1, ["testTube", "testTube2"], {
                    "create": function() {
                        return failureStrategy;
                    }
                });
            }
        ]);

        var $injector = angular.bootstrap(angular.element(document.querySelector('head')), ['testModule']);

        q = $injector.get('$q');
        rootScope = $injector.get('$rootScope');
        hustle = $injector.get('$hustle');
    });

    var publish = function(n, tube) {
        return function() {
            return hustle.publish(n, tube)
        }
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

    it("should call failure strategy", function(done) {
        var someBlockingCall = function(defered) {
            setTimeout(function() {
                defered.reject();
            }, 100);
        };

        var consumerFunction = function(message) {
            var defered = q.defer();
            someBlockingCall(defered);
            if (message.data === "end") {
                expect(failureStrategy).toHaveBeenCalled();
                done();
            }
            return defered.promise;
        };

        hustle.registerConsumer(consumerFunction, "testTube2").then(function(consumer) {
            publish("foo", "testTube2")().then(publish("end", "testTube2"));
            consumer.start();
        });
    });
});