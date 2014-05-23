describe("hustle angular provider", function() {
    var hustle, rootScope;
    beforeEach(module('hustle', function($hustleProvider) {
        $hustleProvider.init("hustle", 1, ["testTube"]);
    }));

    beforeEach(inject(function($hustle, $rootScope) {
        console.log($hustle);
        hustle = $hustle;
        rootScope = $rootScope;
    }));

    xit("publish and consume a mesage", function(done) {
        hustle.registerConsumer(function(message) {
            console.log(message);
            done();
        }, "testTube");
        hustle.publish("test message", "testTube");
        rootScope.$apply();
    });
});