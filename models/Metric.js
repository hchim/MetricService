var mongoose = require("mongoose");
var conf = require("../config");

var metricSchema = mongoose.Schema({
    tag: String,
    type: String,   // count | time | error | msg
    app: String,
    createTime: {type: Date, default: Date.now},
    count: Number,  //count type
    time: Number,  //time type, in miliseconds
    message: String,  // error and msg type
    hostname: String,       //ip address that generate this error
    platform: String,
    osVersion: String,
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