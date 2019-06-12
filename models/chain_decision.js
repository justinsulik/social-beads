// Stores information about bead decisions
/*jshint esversion: 6 */

const mongoose = require('mongoose');

const decisionSchema = new mongoose.Schema({
  sessId: String,
  trialId: String,
  studyName: String,
  generation: Number,
  chain: Number,
  drawsToDecision: Number,
  choice: Number,
  branch: Number
});

let Chain_decision = module.exports = mongoose.model('Chain_decision', decisionSchema);
