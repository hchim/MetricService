var mongoose = require("mongoose");
var conf = require("../config");

var metricSchema = mongoose.Schema({
    tag: String,
    type: String,   // count | time | error | msg
    appName: String,
    appVersion: String,
    createTime: {type: Date, default: Date.now},
    count: Number,  //count type
    time: Number,  //time type, in miliseconds
    message: String,  // error and msg type
    hostname: String,       //ip address that generate this error
    device: {
        model: String,
        brand: String,
        serial: String,
    },
    "os": {
        os_name: String,
        sdk_int: Number,
        os_type: String,
        fingerprint: String,
    }
});

// indexes

metricSchema.index({ tag: 1, createTime: 1});
metricSchema.index({ ip: 1, createTime: 1});

if (conf.get("env") === 'production') {
    metricSchema.set('autoIndex', false);
} else {
    metricSchema.set('autoIndex', true);
}

// methods

var Metric = mongoose.model('Metric', metricSchema);

module.exports = Metric;