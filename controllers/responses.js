//https://www.terlici.com/2015/04/03/mongodb-node-express.html

const express = require('express'),
    router = express.Router(),
    mongoose = require( 'mongoose'),
    Response = require('./../models/response');

exports.save = function (sessionData) {
  console.log('Saving trial data in db...');
  Response.create(sessionData);
};
