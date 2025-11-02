var express = require('express');
var router = express.Router();
const programHelper = require('../helpers/program-helper');
const resultHelper = require('../helpers/result-helper');
const collections = require('../config/collections');
const connectDB = require('../config/db');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('user/cover',{cover:true});
});

router.get('/results', async function(req, res, next) {
  let fName = await programHelper.GetFestName();
  fName = fName[0] ? fName[0].festName : 'Zing Zephyr 2025';
  
  // Get published results
  const publishedResults = await resultHelper.getPublishedResults();
  
  res.render('user/view-results', { 
    fName, 
    publishedResults: publishedResults || []
  });
});

router.get('/user/enter', async function(req, res, next) {
  let fName = await programHelper.GetFestName();
  fName = fName[0] ? fName[0].festName : 'Zing Zephyr 2025';
  
  // Get published results
  const publishedResults = await resultHelper.getPublishedResults();
  
  // Get published team points
  const database = await connectDB();
  const publishedTeamData = await database.collection(collections.PUBLISHED_TEAM).findOne();
  const publishedTeams = publishedTeamData ? publishedTeamData.teams : [];
  
  // Get all teams for display
  const teams = await programHelper.viewAllTeamData();
  
  res.render('user/home-page', { 
    fName, 
    publishedResults: publishedResults || [],
    publishedTeams: publishedTeams || [],
    teams: teams || []
  });
});

module.exports = router;
