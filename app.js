var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var conf = require("./config");
var middlewares = require('service-middlewares')(conf)
var utils = require('servicecommonutils');

var winston = utils.getWinston(conf.get('env'));

//routes
var index = require('./routes/index');
var metrics = require('./routes/metrics');

var app = express();
var logDirectory = __dirname + '/log';
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', index)
//request signature checkup
if (conf.get("env") !== 'test') {
    app.use(middlewares.signature_middleware)
}

// setup routes
app.use('/metrics', metrics);

//catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('404 Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stack trace
if (conf.get("env") === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.json(utils.encodeResponseBody(req, {
            message: err.message,
            error: err
        }));
    });
}

// production error handler
// no stack traces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    winston.log('error', err.message, err);
    res.json(utils.encodeResponseBody(req, {
        message: err.message
    }));
});

module.exports = app;
