var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Metric = require("metricservicemodels").Metric(mongoose.connection);
var utils = require('servicecommonutils');

/*
* Add or update baby info.
* req.body.birthday: in 'yyyy-MM-dd' format
*/
router.post("/", function(req, res, next) {
  var model = utils.nestedReqField(req.body, 'device', 'model');
  var brand = utils.nestedReqField(req.body, 'device', 'brand');
  var serial = utils.nestedReqField(req.body, 'device', 'serial');
  var os_name = utils.nestedReqField(req.body, 'os', 'os_name');
  var sdk_int = utils.nestedReqField(req.body, 'os', 'sdk_int');
  var sdk_int_val = parseInt(sdk_int);
  var os_type = utils.nestedReqField(req.body, 'os', 'os_type');
  var fingerprint = utils.nestedReqField(req.body, 'os', 'fingerprint');

  var metricObj = {
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
  };

  if (metricObj.type === 'count') {
      metricObj['count'] = req.body.count;
  } else if (metricObj.type === 'time') {
      metricObj['time'] = req.body.time;
  } else {
      metricObj['message'] = req.body.message;
  }

  Metric.create(metricObj).then(function(metric) {
      return res.json(utils.encodeResponseBody(req, {
          '_id': metric._id,
          'tag': metric.tag,
          'createTime': metric.createTime
      }));
  }).catch(function (err) {
      return next(err);
  });
});

module.exports = router;
