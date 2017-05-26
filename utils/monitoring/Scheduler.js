var TaskConsumer = require('./TaskCosumer');
var TaskRecoverer = require('./TaskRecoverer');

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
    this.taskConsumer = new TaskConsumer(taskRetrieveInterval, taskNumPerRequest);
    this.taskRecoverer = new TaskRecoverer(taskResumeInterval, resumeTaskNumPerRequest, taskTimeoutTime);
};

/**
 * Start to work.
 */
Scheduler.prototype.start = function () {
    this.taskConsumer.start();
    this.taskRecoverer.start();
};

Scheduler.prototype.stop = function () {
    this.taskConsumer.stop();
    this.taskRecoverer.stop();
};

module.exports = Scheduler;
