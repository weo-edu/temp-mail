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

console.log('connected to redis...', REDIS_URL);
var redis = require('redis-url').connect(REDIS_URL);
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser')
var app = express();



/**
 * SMTP server
 */

/*var smtp = simplesmtp.createServer({
  enableAuthentication: true,
  requireAuthentication: false,
  SMTPBanner: 'tempsmtp',
  disableDNSValidation: true
});

smtp.listen(SMTP_PORT);
console.log('SMTP server listening on port ' + SMTP_PORT);

smtp.on('startData', function(connection) {
  connection.mailparser = new MailParser();
  connection.mailparser.on('end', function(mail_object) {
    console.log('received email', mail_object);
    _.each(mail_object.to, function(to) {
      redis.lpush(tempmail + to, JSON.stringify(mail_object), function(err) {
        connection.donecallback(null, 1); //XXX what is this supposed to be;
      });
    });
  });
});

smtp.on("data", function(connection, chunk){
  connection.mailparser.write(chunk);
});

smtp.on("dataReady", function(connection, callback){
  connection.donecallback = callback;
  connection.mailparser.end();
});*/

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
      redis.expire(REDIS_KEY + req.session.email.toLowerCase(), MAX_AGE / 1000, function(err) {
        next(err);
      })
    })
  } else {
    next();
  }
}, function(req, res) {
  redis.lrange(REDIS_KEY + req.session.email.toLowerCase(), 0, 9, function(err, result) {
    if (err) throw err;
    res.json({
      email: req.session.email.toLowerCase(),
      items: result.map(JSON.parse)
    });
  });
});

app.post('/webhook', function(req, res) {
  var email = req.body;
  console.log('email', email)
  async.each(email.ToFull, function(to, cb) {
    redis.lpush(REDIS_KEY + to.Email.toLowerCase(), JSON.stringify(email), cb);
  }, function(err) {
    res.send(201);
  });
});

app.listen(HTTP_PORT);
console.log('HTTP server listening on port ' + HTTP_PORT);