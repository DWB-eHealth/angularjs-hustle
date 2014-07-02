describe("hustle angular provider", function() {
    var hustle, rootScope, q;
    var FailureStrategy = function() {
        this.create = function() {

        }
    };

    beforeEach(function() {
        var app = angular.module("testModule", ["hustle"]);
        app.config(["$hustleProvider",
            function($hustleProvider) {
                $hustleProvider.init("hustle", 1, ["testTube"], new FailureStrategy());
            }
        ]);

        var $injector = angular.bootstrap(angular.element(document.querySelector('head')), ['testModule']);

        q = $injector.get('$q');
        rootScope = $injector.get('$rootScope');
        hustle = $injector.get('$hustle');
    });

    it("publish and consume a mesage", function(done) {
        hustle.registerConsumer(function(message) {
            console.log(message);
        }, "testTube").then(function(consumer) {
            console.log("registering");
            consumer.start();
            done();
        }, function() {
            console.log("erro");
        });
        hustle.publish("test message", "testTube");
    });
});