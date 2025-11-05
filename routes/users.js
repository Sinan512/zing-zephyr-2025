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
  
  // Get published results with only top 3 participants
  const publishedResults = await resultHelper.getPublishedResultsTop3();
  
  res.render('user/results', { 
    fName, 
    publishedResults: publishedResults || []
  });
});

router.get('/team-status', async function(req, res, next) {
  let fName = await programHelper.GetFestName();
  fName = fName[0] ? fName[0].festName : 'Zing Zephyr 2025';
  
  // Get published team points with program count
  const publishedTeamData = await resultHelper.getPublishedTeamPoints();
  const publishedTeams = publishedTeamData.teams || [];
  const programCount = publishedTeamData.programCount || 0;
  
  res.render('user/team-status', { 
    fName, 
    publishedTeams: publishedTeams || [],
    programCount: programCount
  });
});

router.get('/user/enter', async function(req, res, next) {
  let fName = await programHelper.GetFestName();
  fName = fName[0] ? fName[0].festName : 'Zing Zephyr 2025';
  
  // Get published results
  const publishedResults = await resultHelper.getPublishedResults();
  
  // Get published team points with program count
  const publishedTeamData = await resultHelper.getPublishedTeamPoints();
  const publishedTeams = publishedTeamData.teams || [];
  const programCount = publishedTeamData.programCount || 0;
  
  // Get all teams for display
  const teams = await programHelper.viewAllTeamData();
  
  res.render('user/home-page', { 
    fName, 
    publishedResults: publishedResults || [],
    publishedTeams: publishedTeams || [],
    programCount: programCount,
    teams: teams || []
  });
});

router.get('/zone-toppers', async function(req, res, next) {
  let fName = await programHelper.GetFestName();
  fName = fName[0] ? fName[0].festName : 'Zing Zephyr 2025';
  
  // Get published zone toppers
  const publishedZoneToppers = await resultHelper.getPublishedZoneToppers();
  console.log(publishedZoneToppers);
  
  res.render('user/zone-toppers', { 
    fName, 
    zoneToppers: publishedZoneToppers || {}
  });
});

module.exports = router;
