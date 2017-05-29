var mongoose = require('mongoose');
var conf = require("../config");
var Metric = require('metricservicemodels').Metric(mongoose.connection);
var Monitor = require('metricservicemodels').Monitor(mongoose.connection);
var Task = require('metricservicemodels').Task(mongoose.connection);

var dbUrl = conf.get('mongodb.url');
const os = require('os');

const COUNT = {
    tag: "MetricService:counttest",
    type: 'count',
    appName: 'MetricTest',
    appVersion: '1.0.1',
    count: 1,
    hostname: os.hostname(),
    device: {
        model: 'Nexus 4',
        brand: 'google',
        serial: 'fakeserialnum'
    },
    "os": {
        os_name: 'Android',
        sdk_int: 22,
        os_type: "user",
        fingerprint: "fakefingerprint"
    }
};

const TIME = {
    tag: "MetricService:timetest",
    type: 'time',
    appName: 'MetricTest',
    appVersion: '1.0.1',
    time: 734,
    hostname: os.hostname(),
    device: {
        model: 'Nexus 4',
        brand: 'google',
        serial: 'fakeserialnum'
    },
    "os": {
        os_name: 'Android',
        sdk_int: 22,
        os_type: "user",
        fingerprint: "fakefingerprint"
    }
};

const ERROR = {
    tag: "MetricService:errortest",
    type: 'error',
    appName: 'MetricTest',
    appVersion: '1.0.1',
    message: 'error message',
    hostname: os.hostname(),
    device: {
        model: 'Nexus 4',
        brand: 'google',
        serial: 'fakeserialnum'
    },
    "os": {
        os_name: 'Android',
        sdk_int: 22,
        os_type: "user",
        fingerprint: "fakefingerprint"
    }
};

function generateData() {
    var data;
    var type = Math.round(Math.random() * 3);
    if (type == 0) {
        data = new Metric(COUNT);
    } else if (type == 1) {
        data = new Metric(TIME);
        data.time = Math.round(Math.random() * 2000);
    } else {
        data = new Metric(ERROR);
    }
    var now = new Date();
    data.createTime = new Date(now.getTime() - Math.round(Math.random() * 30 * 60000));
    data.save(function (err, data) {
        console.log('inserted : ' + data._id);
    });
}

mongoose.connect(dbUrl, null, function (error) {
    if(error) {
        console.error(error);
        return;
    }

    mongoose.set('debug', true);

    setInterval(generateData, 100);
});