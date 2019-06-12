const mongoose = require('mongoose');

var state = {
  db: null,
};

exports.connect = function(uri){
  if (state.db) return done();
  mongoose.connect(uri);
  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('connected', function callback () {
    console.log('connected to db...');
    state.db = db;
  });
};

exports.get = function() {
  return state.db;
};

exports.close = function() {
  if (state.db) {
    state.db.disconnect();
    console.log('connection to db closed...');
  }
};
