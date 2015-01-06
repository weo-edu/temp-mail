/**
 * Config
 */

var SMTP_PORT = process.env.SMTPPORT || 2525;
var HTTP_PORT = process.env.PORT || 2526;
var REDIS_KEY = 'tempmail:'
var MAX_AGE = 10 * 60 * 1000;
var DOMAIN = process.env.DOMAIN || 'localhost';
var REDIS_URL = process.env.REDISTOGO_URL || 'redis://localhost:6379';

/**
 * Modules
 */

var simplesmtp = require('simplesmtp');
var MailParser = require('mailparser').MailParser;
var hash = require('./hashid');
var _ = require('lodash');
var async = require('async');

var redis = require('redis-url').connect(REDIS_URL);
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser')
var app = express();
var noop = function(){};

/**
 * HTTP server
 */

app.use(cookieParser());
app.use(bodyParser.json())
app.use(session({secret: '1234567890QWERTY', cookie: {maxAge: MAX_AGE}}));

app.get('/', function(req, res, next) {
  if (!req.session.email) {
    hash(function(err, id) {
      if (err) return next(err);
      req.session.email = id + '@' + DOMAIN;
      console.log('expire in', MAX_AGE / 1000);
      redis.expire(REDIS_KEY + req.session.email, MAX_AGE / 1000, function(err) {
        next(err);
      });
    })
  } else {
    next();
  }
}, function(req, res) {
  redis.lrange(REDIS_KEY + req.session.email, 0, 9, function(err, result) {
    if (err) throw err;
    res.json({
      email: req.session.email,
      items: result.map(JSON.parse)
    });
  });
});

app.post('/webhook', function(req, res) {
  var email = req.body;
  async.each(email.ToFull, function(to, cb) {
    console.log('expire in', MAX_AGE / 1000);
    redis.expire(REDIS_KEY + to.Email, MAX_AGE / 1000, noop);
    redis.lpush(REDIS_KEY + to.Email, JSON.stringify(email), cb);
  }, function(err) {
    res.send(201);
  });
});

app.listen(HTTP_PORT);
console.log('HTTP server listening on port ' + HTTP_PORT);