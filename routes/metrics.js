var express = require('express');
var router = express.Router();
var Metric = require("../models/Metric");

/*
* Add or update baby info.
* req.body.birthday: in 'yyyy-MM-dd' format
*/
router.post("/", function(req, res, next) {
  var metric = new Metric({
    tag: req.body.tag,
    type: req.body.type,
    app: req.body.app,
    hostname: req.body.hostname,
    platform: req.body.platform,
    osVersion: req.body.osVersion
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
