describe("hustle angular provider", function() {
    var hustle, rootScope, q, app;
    beforeEach(function() {
        if (app) return;
        app = angular.module("testModule", ["hustle"]);
        app.config(["$hustleProvider",
            function($hustleProvider) {
                $hustleProvider.init("hustle", 1, ["testTube"], {
                    "create": function() {
                        return function() {};
                    }
                });
            }
        ]);

        var $injector = angular.bootstrap(angular.element(document.querySelector('head')), ['testModule']);

        q = $injector.get('$q');
        rootScope = $injector.get('$rootScope');
        hustle = $injector.get('$hustle');
    });

    it("should consume messages one at a time in order", function(done) {
        var currentIndex = 1;
        var numberOfTestCases = 40;
        var someFunction = function(message) {
            var defered = q.defer();
            expect(message.data).toEqual(currentIndex);
            if (currentIndex >= numberOfTestCases)
                done();
            currentIndex++;
            setTimeout(function() {
                defered.resolve();
            }, 100);
            return defered.promise;
        };

        hustle.registerConsumer(someFunction, "testTube").then(function(consumer) {
            var publish = function(n) {
                return function() {
                    return hustle.publish(n, "testTube")
                }
            };
            var p = publish(1)();
            for (var i = 2; i <= numberOfTestCases; i++) {
                p = p.then(publish(i));
            }
            p.then(consumer.start);
        });
    });
});