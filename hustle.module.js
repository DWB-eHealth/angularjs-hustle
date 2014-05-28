(function(angular) {
    angular.module('hustle', []).provider('$hustle', function() {
        var self = this;
        var hustle;
        var $q;

        var getHustle = function() {
            var deferred = $q.defer();
            if (!hustle) {
                deferred.reject("Please call init on provider first.");
            } else if (hustle.is_open()) {
                deferred.resolve(hustle);
            } else {
                hustle.open({
                    "success": function(e) {
                        deferred.resolve();
                    },
                    "error": function(e) {
                        deferred.reject(e);
                    }
                });
            }
            return deferred.promise;
        };

        var publishMessage = function(message, tube) {
            var deferred = $q.defer();
            hustle.Queue.put(message, {
                "tube": tube,
                "success": function(item) {
                    deferred.resolve(item.id);
                },
                "error": function(e) {
                    deferred.reject(e);
                }
            });
            return deferred.promise;
        };

        var register = function(callback, tube, delay) {
            var callCallbackAndDeleteItemFromQ = function(job) {
                $q.when(callback.call(this, job)).then(function() {
                    hustle.Queue.delete(job.id);
                });
            };

            return new hustle.Queue.Consumer(callCallbackAndDeleteItemFromQ, {
                "tube": tube,
                "delay": delay
            });
        };

        self.init = function(db_name, db_version, tubes) {
            hustle = new Hustle({
                "db_name": db_name,
                "db_version": db_version,
                "tubes": tubes
            });
        };

        self.$get = ['$q', '$rootScope',
            function(q, $rootScope) {
                $q = q;

                var publish = function(message, tube) {
                    return getHustle().then(function() {
                        return publishMessage(message, tube);
                    });
                };

                var registerConsumer = function(callback, tube, delay) {
                    return getHustle().then(function() {
                        return register(callback, tube, delay);
                    });
                };

                return {
                    "publish": publish,
                    "registerConsumer": registerConsumer
                };
            }
        ];

    });
}(angular));