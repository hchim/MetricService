/**
 * Created by huiche on 1/13/17.
 */
var assert = require('assert');
var mongoose = require('mongoose');
var conf = require("../config");
var request = require('request');
var expect = require('Chai').expect;
var Metric = require('../models/Metric');
var port = conf.get('server.port');
var ip = conf.get("server.ip");
var dbUrl = conf.get('db.mongodb.url');
var endpoint = 'http://' + ip + ':' + port + '/metrics/';
const os = require('os');

describe('/metrics', function() {

    before(function(done) {
        mongoose.connect(dbUrl, function (err) {
            if (err) {
                return done(err);
            }
            console.log("Connected to mongodb: " + dbUrl);
            mongoose.set('debug', true);
            Metric.remove({});
            done();
        });
    });

    after(function(done) {
        mongoose.disconnect();
        done();
    });

    describe('POST \'/metrics\'', function() {
        it('should successfully add count metric.', function(done) {
            var formData = {
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
            request.post({url: endpoint, form: formData}, function (err, res, body){
                if (err) done(err);

                var json = JSON.parse(body);
                expect(res.statusCode).to.equal(200);
                expect(json.tag).to.equal(formData.tag);
                done();
            });
        });

        it('should successfully add time metric.', function(done) {
            var formData = {
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
            request.post({url: endpoint, form: formData}, function (err, res, body){
                if (err) done(err);

                var json = JSON.parse(body);
                expect(res.statusCode).to.equal(200);
                expect(json.tag).to.equal(formData.tag);
                done();
            });
        });

        it('should successfully add error metric.', function(done) {
            var formData = {
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
            request.post({url: endpoint, form: formData}, function (err, res, body){
                if (err) done(err);

                var json = JSON.parse(body);
                expect(res.statusCode).to.equal(200);
                expect(json.tag).to.equal(formData.tag);
                done();
            });
        });
    });
});