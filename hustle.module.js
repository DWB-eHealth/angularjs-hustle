(function(angular) {
    angular.module('hustle', []).provider('$hustle', function() {
        var self = this;
        var hustle, onSuccess, onFailure, shouldRetry, $q;
        var Consumer = function(fn, coptions) {
            coptions = coptions || {};
            var tube = coptions.tube ? coptions.tube : 'default';
            var delay = coptions.delay ? coptions.delay : 100;
            var retryDelayConfig = coptions.retryDelayConfig;
            var do_stop = true;
            var do_retry = false;
            var retryDelay = 100;

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
                    if (do_retry) {
                        setTimeout(poll, retryDelay);
                        do_retry = false;
                    } else {
                        setTimeout(poll, delay);
                    }
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
                        if (onSuccess)
                            onSuccess(job);
                        hustle.Queue.delete(job.id);
                    }).
                    catch(function(failureMessage) {
                        if (shouldRetry) {
                            if (shouldRetry(job, failureMessage)) {
                                do_retry = true;
                                retryDelay = retryDelayConfig && retryDelayConfig[job.releases] ? retryDelayConfig[job.releases] : retryDelay;
                                hustle.Queue.release(job.id);
                            } else {
                                hustle.Queue.bury(job.id);
                            }
                        } else if (onFailure)
                            onFailure(job, failureMessage);
                    });
                };

                var reserveSuccess = function(item) {
                    if (!item) return;
                    return callCallbackAndDeleteItemFromQ(item, fn);
                };

                $q.when(hustle.Queue.reserve({
                    "tube": tube
                })).then(reserveSuccess).
                finally(pollAgain);
            };

            var start = function() {
                console.debug("hustle module consumer start", do_stop);
                if (!do_stop) return false;
                do_stop = false;
                setTimeout(poll, delay);
                return true;
            };

            var stop = function() {
                console.debug("hustle module consumer stop", do_stop);
                if (do_stop) return false;
                do_stop = true;
                return true;
            };

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

        var register = function(callback, tube, delay, retryDelayConfig) {
            return new Consumer(callback, {
                "tube": tube,
                "delay": delay,
                "retryDelayConfig": retryDelayConfig
            });
        };

        self.init = function(db_name, db_version, tubes) {
            hustle = new Hustle({
                "db_name": db_name,
                "db_version": db_version,
                "tubes": tubes
            });
            hustle.promisify();
        };

        self.$get = ['$q', '$rootScope',
            function(q, $rootScope) {
                $q = q;

                var publish = function(message, tube) {
                    return getHustle().then(function() {
                        return publishMessage(message, tube);
                    });
                };

                var registerConsumer = function(callback, tube, delay, retryDelayConfig) {
                    return getHustle().then(function() {
                        return register(callback, tube, delay, retryDelayConfig);
                    });
                };

                var registerInterceptor = function(interceptor) {
                    onSuccess = interceptor.onSuccess;
                    onFailure = interceptor.onFailure;
                    shouldRetry = interceptor.shouldRetry;
                };

                return {
                    "publish": publish,
                    "registerConsumer": registerConsumer,
                    "registerInterceptor": registerInterceptor
                };
            }
        ];
    });
}(angular));
