var winston = require('winston');
var redlockHelper = require('./RedlockHelper');
var mongoose = require('mongoose');
var Monitor = require('metricservicemodels').Monitor(mongoose.connection); //required by the populate operation
var Task = require("metricservicemodels").Task(mongoose.connection);
var Metric = require('metricservicemodels').Metric(mongoose.connection);
var mapFuns = require('metricservicemodels').Map;
var reduceFuns = require('metricservicemodels').Reduce;
var async = require('async');

var monitorConf = require('./MonitorConf');
var redlock = redlockHelper.getRedlock();

/**
 * Retrieve <num> tasks from the queue and schedule the tasks.
 * @param num
 * @param _this
 */
var retrieveTask = function (num, _this) {
    redlock.lock(monitorConf.Redlock_ID, monitorConf.Redlock_TTL, function(err, lock) {
        if(err) {
            winston.log('error', 'Failed to acquire redlock: ' + monitorConf.Redlock_ID, err);
            return;
        }

        Task.find({isActive: true, status: 'ready'})
            .sort({nextExecuteTime: 1})
            .limit(num)
            .populate('_monitor')
            .exec(function (err, tasks) {
                if (err) {
                    winston.log("error", 'Failed to retrieve tasks.', err);
                    return lock.unlock();
                }
                //asynchronously schedule all the tasks
                async.each(tasks, function(task){
                    var scheduledTime = scheduleTask(task, _this);
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
                lock.unlock();
            });
    });
};

/**
 * Schedule a task.
 * @param task
 * @returns {Date}
 */
var scheduleTask = function (task, _this) {
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

    var timeout = setTimeout(
        executeMonitoringTask,
        scheduledTime.getTime() - now.getTime(),
        query,
        task._id,
        monitor.statInterval,
        monitor.aboveOrBelow,
        monitor.threshold,
        _this
    );

    _this.addTask(task._id, timeout);

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
var executeMonitoringTask = function (query, taskId, statInterval, aboveOrBelow, threshold, _this) {
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
            redlock.lock(monitorConf.Redlock_ID, monitorConf.Redlock_TTL, function(err, lock) {
                if (err) {
                    winston.log('error', 'Failed to acquire redlock: ' + Task_Priority_Queues, err);
                    return;
                } else {
                    Task.update({_id: taskId }, { $set: { status: 'ready'}}, function (err, raw) {
                        if (err) {
                            //The TaskRecoverer will reset the state of the task.
                            winston.log('error', 'Failed to update the status of task: ' + taskId, err);
                        }
                        _this.removeTask(taskId);
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
 * @param executeInterval The execution interval of the task consumer.
 * @param numOfTasksPerRequest The number of tasks to retriever in each request.
 * @constructor
 */
var TaskConsumer = function (executeInterval, numOfTasksPerRequest) {
    this.executeInterval = executeInterval || monitorConf.Consumer.Execute_interval;
    this.numOfTasksPerRequest = numOfTasksPerRequest || monitorConf.Consumer.Tasks_per_req;
    this.scheduledTasks = {};
    this.isActive = false;
};

/**
 * Start the task consumer.
 */
TaskConsumer.prototype.start = function () {
    if (this.isActive) {
        return;
    }

    winston.log('info', 'Start TaskConsumer: Execute interval: ' + this.executeInterval + 'ms Tasks per request: ' + this.numOfTasksPerRequest);
    this.timeout = setInterval(retrieveTask, this.executeInterval, this.numOfTasksPerRequest, this);
    this.isActive = true;
};

/**
 * @param forceStop Force to stop all the scheduled tasks.
 */
TaskConsumer.prototype.stop = function (forceStop) {
    if (this.timeout) {
        winston.log('info', 'Stop TaskConsumer.');
        clearInterval(this.timeout);

        if (forceStop) {
            forEach(this.scheduledTasks.values, function (timeout) {
               clearTimeout(timeout);
            });
        }
        this.isActive = false;
    }
};

/**
 * Add a scheduled task.
 * @param taskId
 * @param timeout
 */
TaskConsumer.prototype.addTask = function (taskId, timeout) {
    this.scheduledTasks[taskId] = timeout;
};

/**
 * Remove a scheduled task.
 * @param taskId
 */
TaskConsumer.prototype.removeTask = function (taskId) {
    delete this.scheduledTasks[taskId];
};

module.exports = TaskConsumer;