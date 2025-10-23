var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('admin/cover',{cover:true});
});

router.get('/enter', function(req, res) {
  res.render('admin/home',{admin:true});
});

module.exports = router;
