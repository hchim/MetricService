var utils = require('servicecommonutils');
var conf = require('../config');
var mongoose = require('mongoose');
var Monitor = require('metricservicemodels').Monitor(mongoose.connection); //required by the populate operation
var Task = require("metricservicemodels").Task(mongoose.connection);
var Metric = require('metricservicemodels').Metric(mongoose.connection);
var Redlock = require('redlock');
var winston = require('winston');
var mapFuns = require('metricservicemodels').Map;
var reduceFuns = require('metricservicemodels').Reduce;
var async = require('async');

var host = conf.get('redis.host')
var port = conf.get('redis.port')
var redisClient = utils.createRedisClient(host, port)

winston.level = 'info';

var Task_Priority_Queues = "MetricService:MonitorTaskQueue";
// the maximum amount of time you want the resource locked,
// keeping in mind that you can extend the lock up until
// the point when it expires
var redlockTTL = 30000; //it does not hurt to set a larger number if everything runs correctly

var redlock = new Redlock(
    // should have one client for each redis node in your cluster
    [redisClient],
    {
        // the expected clock drift; for more details see http://redis.io/topics/distlock
        driftFactor: 0.01, // time in ms
        // the max number of times Redlock will attempt to lock a resource before erroring
        retryCount:  10,
        // the time in ms between attempts
        retryDelay:  400, // time in ms
        // the max time in ms randomly added to retries
        // to improve performance under high contention
        retryJitter:  400 // time in ms
    }
);

/**
 * This function tried to retrieve a task from the queue.
 */
var retrieveTask = function (taskNum) {
    redlock.lock(Task_Priority_Queues, redlockTTL, function(err, lock) {
        if(err) {
            winston.log('error', 'Failed to acquire redlock: ' + Task_Priority_Queues, err);
            return lock.unlock();
        } else {
            Task.find({isActive: true, status: 'ready'})
                .sort({nextExecuteTime: 1})
                .limit(taskNum)
                .populate('_monitor')
                .exec(function (err, tasks) {
                    if (err) {
                        winston.log("error", 'Failed to retrieve a task.', err);
                        return lock.unlock();
                    }

                    async.each(tasks, function(task){
                        var scheduledTime = scheduleTask(task);
                        //update task status
                        var interval = task._monitor.statInterval * 60000;
                        task.status = 'scheduled';
                        task.scheduledExecuteTime = scheduledTime;
                        task.nextExecuteTime = new Date(scheduledTime.getTime() + interval);
                        task.save(function (err, task) {
                            if (err) {
                                winston.log('error', 'Failed to update task status.', err);
                            }
                        });
                    });

                    if (tasks.length > 0) {
                        winston.log('info', 'Successfully scheduled ' + tasks.length + ' tasks.');
                    }
                    //after all the tasks are saved, release the lock
                    return lock.unlock();
                });
        }
    });
};

/**
 * Schedule a task.
 * @param task
 * @returns {Date}
 */
var scheduleTask = function (task) {
    var now = new Date();
    var scheduledTime = task.nextExecuteTime;

    if (scheduledTime < now.getTime()) {
        scheduledTime = now;
    }
    var monitor = task._monitor;
    var fromTime = new Date(scheduledTime - monitor.lastForTime * 60 * 1000);
    var query = {
        tag: monitor.tag,
        type: monitor.type,
        createTime: {
            $gte: fromTime, $lte: scheduledTime
        }
    };
    if (monitor.appName) {
        query['appName'] = monitor.appName;
    }
    if (monitor.appVersion) {
        query['appVersion'] = monitor.appVersion;
    }
    if (monitor.hostname) {
        query['hostname'] = monitor.hostname;
    }
    if (monitor.osName) {
        query['os.name'] = new RegExp(monitor.osName, 'ig');
    }

    setTimeout(
        executeMonitoringTask,
        scheduledTime.getTime() - now.getTime(),
        query,
        task._id,
        monitor.statInterval,
        monitor.aboveOrBelow,
        monitor.threshold
    );

    return scheduledTime;
};

/**
 * Execute the monitoring task.
 * @param query
 * @param taskId
 * @param statInterval
 * @param aboveOrBelow
 * @param threshold
 */
var executeMonitoringTask = function (query, taskId, statInterval, aboveOrBelow, threshold) {
    Metric.mapReduceQuery(
        query,
        function (error, results) {
            if (error) {
                winston.log('error', 'Failed to execute monitoring task.', error, query);
                return;
            }

            var triggerAlarm = true;
            results.forEach(function (item, index, arr) {
                if (aboveOrBelow == 'above') {
                    if (item.value < threshold) {
                        triggerAlarm = false;
                    }
                } else {
                    if (item.value > threshold) {
                        triggerAlarm = false;
                    }
                }
            });

            if (triggerAlarm) {
                //TODO send AWS SNS message
            }

            //update task status
            redlock.lock(Task_Priority_Queues, redlockTTL, function(err, lock) {
                if (err) {
                    winston.log('error', 'Failed to acquire redlock: ' + Task_Priority_Queues, err);
                    return lock.unlock();
                } else {
                    Task.update({ _id: taskId }, { $set: { status: 'ready' }}, function (err, raw) {
                        if (err) {
                            winston.log('error', 'Failed to update the status of task: ' + taskId, err);
                        }
                        return lock.unlock();
                    });
                }
            });
        },
        mapFuns.metric5MMap,
        query.type == 'time' ? reduceFuns.timeMetricReduce : reduceFuns.countMetricReduce
    );
};

/**
 * Check timed out tasks and reset the state.
 */
var checkTimedOutTasks = function (taskNum, timeoutTime) {
    redlock.lock(Task_Priority_Queues, redlockTTL, function(err, lock) {
        if(err) {
            winston.log('error', 'Failed to acquire redlock: ' + Task_Priority_Queues, err);
            return lock.unlock();
        } else {
            var now = new Date();
            var timeout = new Date(now.getTime() - timeoutTime);
            Task.find({isActive: true, status: 'scheduled', 'scheduledExecuteTime' : {$lte: timeout}})
                .sort({nextExecuteTime: 1})
                .limit(taskNum)
                .exec(function (err, tasks) {
                    if (err) {
                        winston.log("error", 'Failed to retrieve a task.', err);
                        return lock.unlock();
                    }

                    async.each(tasks, function(task) {
                        task.status = 'ready';
                        task.save(function (err, task) {
                            if (err) {
                                winston.log('error', 'Failed to reset task status.', err);
                            }
                        });
                    });

                    if (tasks.length > 0) {
                        winston.log('info', 'Successfully reset ' + tasks.length + ' timedout tasks.');
                    }
                    //after all the tasks are saved, release the lock
                    return lock.unlock();
                });
        }
    });
};

/**
 * @param taskRetrieveInterval The time interval between two task retrieving operations.
 * @param taskNumPerRequest The maximum number of ready tasks to fetch for each request.
 * @Param taskResumeInterval The time interval to check timed out tasks and resume their state
 * @param resumeTaskNumPerRequest The maximum number of scheduled tasks to fetch for each requests.
 * @param if (current time - scheduled execute time) > taskTimeoutTime, we think this task had time out and need to reset the state
 * @constructor
 */
var Scheduler = function (
    taskRetrieveInterval,
    taskNumPerRequest,
    taskResumeInterval,
    resumeTaskNumPerRequest,
    taskTimeoutTime) {
    this.taskRetrieveInterval = taskRetrieveInterval;
    this.taskNumPerRequest = taskNumPerRequest;
    this.taskResumeInterval = taskResumeInterval;
    this.resumeTaskNumPerRequest = resumeTaskNumPerRequest;
    this.taskTimeoutTime= taskTimeoutTime;
};

/**
 * Start to work.
 */
Scheduler.prototype.start = function () {
    //start a periodic timer to retrieve tasks from the queue
    setInterval(retrieveTask, this.taskRetrieveInterval, this.taskNumPerRequest);
    //start a periodic timer to reset timed out tasks
    setInterval(checkTimedOutTasks, this.taskResumeInterval, this.resumeTaskNumPerRequest, this.taskTimeoutTime);
};

module.exports = Scheduler;
