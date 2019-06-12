// Stores information about what generation and what chain a user is in
/*jshint esversion: 6 */

const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  sessionId: String,
  trialId: String,
  studyName: String,
  startedDate: { type: Date, default: Date.now },
  generation: Number,
  chain: Number,
  completed: { type: String, default: 'incomplete'},
  branch: { type: Number, default: 0}
});

let Chain_position = module.exports = mongoose.model('Chain_position', positionSchema);
