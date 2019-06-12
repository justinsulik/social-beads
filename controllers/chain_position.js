/*jshint esversion: 6 */

const express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment'),
    Chain_position = require('./../models/chain_position');

function aggregateMap(items){
    // Return an oject with extant chains as keys. The values are further objects with generations as keys
    // Each generation is marked 'completed' if there is one completed entry, and the highest extant branch number is recorded
    console.log('    Aggregating chain data...');
    var aggregateData = {};
    items.forEach((entry) => {
        (entry.chain in aggregateData) || (aggregateData[entry.chain]={});
        ([entry.generation] in aggregateData[entry.chain]) || (aggregateData[entry.chain][entry.generation] = {completed: 'incomplete', branch: 0});
        if (entry.completed == 'completed') {
          aggregateData[entry.chain][entry.generation].completed = 'completed';
        }
        if (entry.branch > aggregateData[entry.chain][entry.generation].branch) {
          aggregateData[entry.chain][entry.generation].branch = entry.branch;
        }
     });
    return aggregateData;
}

function findLatest(aggregateData){
  // find the latest generation in each chain
  var latest = _.reduce(aggregateData, function(chainAcc, chainData, chain){
    chain = +chain;
    var chainLatest = _.reduce(chainData, function(generationAcc, generationData, generation){
      generation = +generation;
      if (generation > generationAcc.generation ||
          (generation == generationAcc.generation && generationData.completed == 'completed')){
        generationAcc.generation = generation;
        generationAcc.completed = generationData.completed;
      }
      return generationAcc;
    }, {generation: 0, completed: null, chain: chain});
    chainAcc[chainLatest.chain] = chainLatest;
    return chainAcc;
  }, {});
  return latest;
}

exports.aggregateMap = aggregateMap;

exports.update = function (newPosition, studyName, trialId) {
  // Once a slot has been selected, create a record in the database to track which slots are currently active/incomplete
  newPosition.studyName = studyName;
  return new Promise((resolve, reject) => {
    var stage = 'Saving new slot';
    console.log(stage);
      Chain_position.create(newPosition, (err, result) => {
        if (err){
          err.name = 'Failed to update position';
          err.trialId = trialId;
          err.stage = stage;
          err.data = newPosition;
          reject(err);
        }
        console.log('    generation', result.generation, 'chain', result.chain);
        resolve(newPosition);
      });
  });
};

exports.complete = function(data, studyName) {
  // Once a participant is finished, and their data base been validated, mark their slot complete
  return new Promise((resolve, reject) => {
    var stage = 'Marking slot complete';
    console.log(stage);
    console.log('   chain', data.chain, 'generation', data.generation, ' branch', data.branch);
    Chain_position.update(
      { chain: data.chain,
        generation: data.generation,
        branch: data.branch,
        studyName: studyName},
      { $set:
        {completed: 'completed'}},
      (err, result) => {
        if (err) {
          console.log('    Error: ', err);
          err.name = 'Failed to mark slot complete';
          err.trialId = data.trialId;
          err.stage = stage;
          reject(err);
        } else {
          console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
          if ( result.n == 0){
            console.log('    No records found!');
          }
          resolve(data);
        }
      });

  });
};

exports.clear_abandoned = function(data, studyName){
  // If a participant closes the experiment window, mark their slot as abandoned
  return new Promise((resolve, reject) => {
    var stage = 'Clearing abandoned slot';
    console.log(stage);
    console.log('   chain', data.chain, 'generation', data.generation, ' branch', data.branch);
    Chain_position.update(
      {chain: data.chain,
       generation: data.generation,
       branch: data.branch,
       studyName: studyName},
      { $set:
        {completed: 'abandoned'}},
      (err, result)=>{
        if (err) {
          console.log('    Error: ', err);
        }
        console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
        if ( result.n == 0){
          console.log('    No records found!');
        }
        resolve(data);
      });
  });
};

exports.clearOld = function (age, trialId) {
  // Each time a new participant clicks the experiment link, clear away any started slots over a certain age
  return new Promise((resolve, reject) => {
    var stage = 'Clearing all unfinished slots';
    console.log(stage);
    var timeDiff = new Date(moment().subtract(age, 'minutes').toISOString());
    Chain_position.update(
      { startedDate: {$lte: timeDiff},
        completed: 'incomplete'},
      { $set:
        {completed: 'defunct'}},
      {multi: true},
      (err, result) => {
        if (err) {
          console.log('    Error: ', err);
          err.name = 'Failed to clear unfinished slots';
          err.trialId = trialId;
          err.stage = stage;
          reject(err);
        } else {
          console.log('    # Records retrieved/modified: ', result.n, '/', result.nModified);
          resolve('resolving with updates');
        }
      });
  });
};

exports.collectData = function(studyName, trialId) {
  // retrieve all slots that might still be active (i.e. incomplete and completed, not abandoned or defunct)
  return new Promise((resolve, reject) => {
    var stage = 'Retrieving slot data';
    console.log(stage);
    var queryList = ['incomplete', 'completed'];
    Chain_position.find(
      {completed: {$in: queryList},
       studyName: studyName},
      (err, items) => {
        if (err) {
          err.stage = stage;
          err.trialId = trialId;
          err.name = 'Error in collecting data';
          reject(err);
        }
        if (items.length > 0){
          console.log('    Chain data retrieved...');
          var aggregateData = aggregateMap(items);
          resolve(aggregateData);
        } else {
          console.log('    Chain data empty...');
          resolve ({});
        }
    });
  });
};

exports.getSlot = function (aggregateData, maxChains, maxGenerations, trialId) {
  // Find a slot for the participant
  return new Promise((resolve, reject) => {
    var stage = 'Getting current slot';
      console.log(trialId, stage);
      var latestSlots = findLatest(aggregateData);
      var candidateChains;
      var candidate;
      if (Object.keys(latestSlots).length < maxChains ){
        // If there are still chains that haven't been started, start one
        candidateChains = _.range(maxChains);
        _.map(latestSlots, function(slotData){
          var index = candidateChains.indexOf(+slotData.chain);
          if (index!=-1){
            candidateChains.splice(index, 1);
          }
        });
        candidate = _.sample(candidateChains);
        resolve({chain: candidate, generation: 0, branch: 0});
      } else {
        // If all chains have been started, choose from among the latest slots
        candidateChains = _.reduce(latestSlots, function(accumulator, chainData){
          if (+chainData.generation < maxGenerations - 1 && chainData.completed == 'completed'){
            accumulator.push(chainData);
          }
          return accumulator;
        }, []);
        if (candidateChains.length>0){
          var temp = _.sample(candidateChains);
          candidate = {generation: +temp.generation+1,
                       chain: temp.chain,
                       branch: 0};
          resolve(candidate);
        } else {
          err = {trialId: trialId,
                 stage: stage,
                 data: aggregateData};
          reject(err);
        }
      }
  });
};
