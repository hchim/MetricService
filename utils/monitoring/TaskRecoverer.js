var winston = require('winston');
var redlockHelper = require('./RedlockHelper');
var mongoose = require('mongoose');
var Task = require("metricservicemodels").Task(mongoose.connection);
var async = require('async');

var monitorConf = require('./MonitorConf');
var redlock = redlockHelper.getRedlock();

/**
 * Check timed out tasks and reset the state.
 */
var resetTimedOutTasks = function (taskNum, timeoutTime) {
    redlock.lock(monitorConf.Redlock_ID, monitorConf.Redlock_TTL, function(err, lock) {
        if(err) {
            winston.log('error', 'Failed to acquire redlock: ' + Task_Priority_Queues, err);
            return;
        }

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
    });
};


/**
 * @param executeInterval
 * @param numOfTasksPerRequest
 * @param taskTimeoutTime
 * @constructor
 */
var TaskRecoverer = function (executeInterval, numOfTasksPerRequest, taskTimeoutTime) {
    this.executeInterval = executeInterval || monitorConf.Recoverer.Execute_interval;
    this.numOfTasksPerRequest = numOfTasksPerRequest || monitorConf.Recoverer.Tasks_per_req;
    this.taskTimeoutTime = taskTimeoutTime || monitorConf.Recoverer.Task_ttl;
    this.isActive = false;
};

TaskRecoverer.prototype.start = function () {
    if (this.isActive) {
        return;
    }

    winston.log('info', 'Start TaskRecoverer: Execute interval: ' + this.executeInterval + 'ms Tasks per request: ' + this.numOfTasksPerRequest);
    this.timeout = setInterval(resetTimedOutTasks, this.executeInterval, this.numOfTasksPerRequest, this.taskTimeoutTime);
    this.isActive = true;
};

TaskRecoverer.prototype.stop = function () {
    if (this.timeout) {
        winston.log('info', 'Stop TaskRecoverer.');
        clearInterval(this.timeout);
        this.isActive = false;
    }
};

module.exports = TaskRecoverer;
