var SIXDIGITOFFSET = 3748096;

var hashids = new (require('hashids'))('themang');
var redis = require('redis').createClient();

module.exports = function(cb) {
  redis.incrby('temp-email:hashid', 1, function(err, id) {
    if(err) throw err;
    id = hashids.encrypt(id + 1 + SIXDIGITOFFSET);
    cb(null, id);
  });
};
