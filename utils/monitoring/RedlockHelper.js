var Redlock = require('redlock');
var utils = require('servicecommonutils');
var conf = require('../../config');

const host = conf.get('redis.host')
const port = conf.get('redis.port')

var RedlockHelper = function () {};

RedlockHelper.redisClient = utils.createRedisClient(host, port);
RedlockHelper.redlock = new  Redlock(
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
RedlockHelper.instance = new RedlockHelper();

RedlockHelper.prototype.getRedlock = function () {
    return RedlockHelper.redlock;
};

module.exports = RedlockHelper.instance;