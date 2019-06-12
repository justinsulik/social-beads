//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    router = express.Router(),
    mongoose = require( 'mongoose'),
    Task = require('./../models/task'),
    {makeCode} = require('./../helper/codeString.js');

exports.save = function (sessionData) {
  console.log('saving session data...');
  Task.create(sessionData);
};

exports.get = function(query, callback) {
  var code = 'blVh';
  Task.findOne(query, 'completionCode', function(err, result){
    if( err ) {
      console.log("Error collecting from DB");
      code = makeCode(2)+'404'+makeCode(5)+'iFi'+makeCode(4)+'NF'+makeCode(2);
    }
    if(!result){
      code = makeCode(2)+'200'+makeCode(5)+'iRi'+makeCode(4)+'NL'+makeCode(2);
    } else {
      code =  result.completionCode;
    }
    callback(code);
  });

};
