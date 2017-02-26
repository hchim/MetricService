var express = require('express');
var router = express.Router();
var Metric = require("../models/Metric");
var commonUtils = require('servicecommonutils');

/*
* Add or update baby info.
* req.body.birthday: in 'yyyy-MM-dd' format
*/
router.post("/", function(req, res, next) {
  var model = commonUtils.nestedReqField(req.body, 'device', 'model');
  var brand = commonUtils.nestedReqField(req.body, 'device', 'brand');
  var serial = commonUtils.nestedReqField(req.body, 'device', 'serial');
  var os_name = commonUtils.nestedReqField(req.body, 'os', 'os_name');
  var sdk_int = commonUtils.nestedReqField(req.body, 'os', 'sdk_int');
  var sdk_int_val = parseInt(sdk_int);
  var os_type = commonUtils.nestedReqField(req.body, 'os', 'os_type');
  var fingerprint = commonUtils.nestedReqField(req.body, 'os', 'fingerprint');

  var metric = new Metric({
    tag: req.body.tag,
    type: req.body.type,
    appName: req.body.appName,
    appVersion: req.body.appVersion,
    hostname: req.body.hostname,
    device: {
      model: model ? model : '',
      brand: brand ? brand : '',
      serial: serial ? serial : ''
    },
    "os": {
      os_name: os_name ? os_name : '',
      sdk_int: isNaN(sdk_int_val) ? 0 : sdk_int_val,
      os_type: os_type ? os_type : '',
      fingerprint: fingerprint ? fingerprint : ''
    }
  });

  if (metric.type === 'count') {
    metric.count = req.body.count;
  } else if (metric.type === 'time') {
    metric.time = req.body.time;
  } else {
    metric.message = req.body.message;
  }

  metric.save(function (err, metric) {
    if (err) {
      return next(err);
    }

    res.json({
      '_id': metric._id,
      'tag': metric.tag,
      'createTime': metric.createTime
    });
  });
});

module.exports = router;
