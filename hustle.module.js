(function(angular) {
    angular.module('hustle', []).provider('$hustle', function() {
        var self = this;
        var hustle, onSuccess, onFailure, shouldRetry, onPublish, onReserve, $q, comparator;
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

                    return $q.when(callCallback()).then(function () {
                        return hustle.Queue.delete(job.id).then(function () {
                            if (onSuccess) onSuccess(job);
                        });
                    }).
                    catch(function(failureMessage) {
                        var callOnFailureCallback = function () {
                            if (onFailure) onFailure(job, failureMessage);
                        };

                        if (shouldRetry && shouldRetry(job, failureMessage)) {
                            do_retry = true;
                            retryDelay = retryDelayConfig && retryDelayConfig[job.releases] ? retryDelayConfig[job.releases] : retryDelay;
                            hustle.Queue.release(job.id).then(callOnFailureCallback);
                        } else {
                            hustle.Queue.bury(job.id).then(callOnFailureCallback);
                        }
                    });
                };

                var reserveSuccess = function(item) {
                    if (!item) return;
                    if (onReserve) onReserve();
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

        var publishMessage = function(message, tube, publishOnce) {
            var options = {"tube": tube};
            if (comparator && publishOnce)
                options.comparator = comparator;
            return hustle.Queue.put(message, options).then(function (job) {
                if(onPublish) onPublish(job);
            });
        };

        var register = function(callback, tube, delay, retryDelayConfig) {
            return new Consumer(callback, {
                "tube": tube,
                "delay": delay,
                "retryDelayConfig": retryDelayConfig
            });
        };

        self.init = function(db_name, db_version, tubes, comparatorFn) {
            hustle = new Hustle({
                "db_name": db_name,
                "db_version": db_version,
                "tubes": tubes
            });
            hustle.promisify();
            comparator = comparatorFn;
        };

        self.$get = ['$q', '$rootScope',
            function(q, $rootScope) {
                $q = q;

                var publish = function(once) {
                    return function (message, tube) {
                        return getHustle().then(function () {
                            return publishMessage(message, tube, once);
                        });
                    };
                };

                var getCount = function(tube) {
                    return getHustle().then(function() {
                        return hustle.Queue.count_ready(tube, {
                            'success': function(count) {
                                return count;
                            },
                            'failure': function(e) {

                            }
                        });
                    });
                };

                var getReservedCount = function() {
                    return getHustle().then(function() {
                        return hustle.Queue.count_reserved({
                            'success': function(count) {
                                return count;
                            },
                            'failure': function(e) {

                            }
                        });
                    });
                };

                var cleanupAbandonedItems = function() {
                    return getHustle().then(function() {
                        return hustle.Queue.cleanup_abandoned_items();
                    });
                };

                var rescueReservedItems = function (maxNumberOfTimesItemCanBeRescued, minTimeToIncrementItemRescuedCount) {
                    var options = {
                        maxRescueLimit: maxNumberOfTimesItemCanBeRescued,
                        rescueTimeLimitInSeconds: minTimeToIncrementItemRescuedCount
                    };
                    return getHustle().then(function () {
                        return hustle.Queue.rescue_reserved_items(options);
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
                    onPublish = interceptor.onPublish;
                    onReserve = interceptor.onReserve;
                };

                return {
                    "publish": publish(false),
                    "publishOnce": publish(true),
                    "registerConsumer": registerConsumer,
                    "registerInterceptor": registerInterceptor,
                    "getCount": getCount,
                    "getReservedCount": getReservedCount,
                    "cleanupAbandonedItems": cleanupAbandonedItems,
                    "rescueReservedItems": rescueReservedItems
                };
            }
        ];
    });
}(angular));
