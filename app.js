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
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', index)
if (conf.get("env") !== 'test') {
    app.use(middlewares.signature_middleware)
}
app.use('/metrics', metrics);

app.use(middlewares.error_404_middleware);
if (conf.get("env") !== 'production') {
    app.use(middlewares.error_500_middleware_dev);
} else {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        winston.log('error', err.message, err);
        res.json(utils.encodeResponseBody(req, {
            message: err.message
        }));
    });
}

module.exports = app;
