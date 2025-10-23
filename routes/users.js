var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.render('user/cover',{cover:true});
});

router.get('/user/enter', function(req, res, next) {
  res.render('user/home-page');
});

module.exports = router;
