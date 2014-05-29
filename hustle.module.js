(function(angular) {
    angular.module('hustle', []).provider('$hustle', function() {
        var self = this;
        var hustle;
        var failureStrategy;
        var $q;
        var Consumer = function(fn, coptions) {
            coptions = coptions || {};
            var tube = coptions.tube ? coptions.tube : 'default';
            var delay = coptions.delay ? coptions.delay : 100;
            var do_stop = false;

            var poll = function(options) {
                options = options || {};
                if (do_stop || !hustle.is_open()) return;
                if (coptions.enable_fn) {
                    var res = coptions.enable_fn();
                    if (!res) {
                        do_stop = true;
                        return false;
                    }
                }

                var pollAgain = function() {
                    setTimeout(function() {
                        poll({
                            skip_recurse: true
                        });
                    }, 0);
                };

                var callCallbackAndDeleteItemFromQ = function(job, callback) {
                    var callCallback = function() {
                        try {
                            return callback.call(this, job);
                        } catch (ex) {
                            return $q.reject();
                        }
                    };

                    return $q.when(callCallback()).then(function() {
                        hustle.Queue.delete(job.id);
                    }).
                    catch (function() {
                        return failureStrategy(job);
                    });
                };

                var reserveSuccess = function(item) {
                    if (!item) return;
                    callCallbackAndDeleteItemFromQ(item, fn).
                    finally(pollAgain);
                };

                hustle.Queue.reserve({
                    "tube": tube
                }).then(reserveSuccess);

                if (!options.skip_recurse) setTimeout(poll, delay);
            };

            var start = function() {
                if (!do_stop) return false;
                do_stop = false;
                setTimeout(poll, delay);
                return true;
            };

            var stop = function() {
                if (do_stop) return false;
                do_stop = true;
                return true;
            };

            setTimeout(poll, delay);

            this.start = start;
            this.stop = stop;

            return this;
        };


        var getHustle = function() {
            var deferred = $q.defer();
            if (!hustle) {
                deferred.reject("Please call init on provider first.");
            } else if (hustle.is_open()) {
                deferred.resolve(hustle);
            } else {
                return $q.when(hustle.open());
            }
            return deferred.promise;
        };

        var publishMessage = function(message, tube) {
            var putPromise = hustle.Queue.put(message, {
                "tube": tube,
            });
            return $q.when(putPromise);
        };

        var register = function(callback, tube, delay) {
            return new Consumer(callback, {
                "tube": tube,
                "delay": delay
            });
        };

        self.init = function(db_name, db_version, tubes, failureStrategyFactory) {
            hustle = new Hustle({
                "db_name": db_name,
                "db_version": db_version,
                "tubes": tubes
            });
            hustle.promisify();
            failureStrategy = failureStrategyFactory.create(hustle);
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