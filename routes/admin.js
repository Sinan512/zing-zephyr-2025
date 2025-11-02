var express = require("express");
var router = express.Router();
const programHelper = require("../helpers/program-helper");
const callListHelper = require("../helpers/callList-helper");
const resultHelper = require("../helpers/result-helper");
const authHelper = require("../helpers/auth-helper");

// Middleware to check if admin is logged in and refresh session
const requireAuth = async (req, res, next) => {
  if (!authHelper.isSessionValid(req)) {
    req.session.destroy();
    return res.redirect("/admin/login");
  }
  // Refresh last activity on each request
  req.session.lastActivity = Date.now();
  next();
};

// Initialize admin credentials on first load
authHelper.initializeAdmin();

/* GET home page. */
router.get("/", (req, res) => {
  res.render("admin/cover", { cover: true });
});

// Login routes
router.get("/login", (req, res) => {
  // If already logged in, redirect to home
  if (authHelper.isSessionValid(req)) {
    return res.redirect("/admin/enter");
  }
  res.render("admin/login", { cover: true });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  
  const isValid = await authHelper.verifyAdmin(username, password);
  
  if (isValid) {
    req.session.adminLoggedIn = true;
    req.session.lastActivity = Date.now();
    res.redirect("/admin/enter");
  } else {
    res.render("admin/login", { cover: true, error: "Invalid username or password" });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/admin/login");
});

router.get("/enter", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  var teams = await programHelper.viewAllTeamData();
  fName = fName[0].festName;
  res.render("admin/home", { admin: true, fName, teams });
});

router.get("/settings", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teams = await programHelper.viewAllTeamData();
  var programs = await programHelper.viewPrograms();
  const success = req.query.success || null;
  const error = req.query.error || null;
  res.render("admin/settings", { admin: true, fName, teams, programs, success, error });
});

router.post("/update-fest-name", requireAuth, async (req, res) => {
  await programHelper.setFestName(req.body);
});

router.post("/reset-credentials", requireAuth, async (req, res) => {
  try {
    const { username, password } = req.body;
    await authHelper.updateAdmin(username, password);
    res.redirect("/admin/settings?success=Credentials updated successfully");
  } catch (error) {
    res.redirect("/admin/settings?error=Failed to update credentials");
  }
});

router.post("/add-team", requireAuth, async (req, res) => {
  var teamName = { ...req.body };
  if (req.body) await programHelper.addTeams(teamName);
  res.redirect("back");
});

router.post("/add-program", requireAuth, async (req, res) => {
  var program = { ...req.body };
  if (program) await programHelper.addPrograms(program);
  res.redirect("/admin/settings");
});

router.get("/add-members/:TName", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teamName = req.params.TName;
  var teamData = await programHelper.viewTeamData(teamName);
  let displayMembers = [];
  for (let zone in teamData) {
    if (Array.isArray(teamData[zone])) {
      teamData[zone].forEach((m) => {
        displayMembers.push({
          member: m.member,
          zone: zone,
        });
      });
    }
  }
  res.render("admin/add-members", {
    admin: true,
    fName,
    teamName,
    displayMembers,
  });
});

router.post("/add-members/:TName", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teamName = req.params.TName;
  var memberDetails = { ...req.body };
  await programHelper.addMember(teamName, memberDetails);

  res.redirect(`/admin/add-members/${teamName}`);
});

router.get("/call-list", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teams = await programHelper.viewAllTeamData();
  var programs = await programHelper.viewPrograms();
  let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    callListData.forEach((prog) => {
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team
      }));
    });
  res.render("admin/call-list", { admin: true,codeLetter:true, fName, teams, programs ,groupedCallList});
});

router.get("/get-members/:teamName/:zone", async (req, res) => {
  const { teamName, zone } = req.params;
  let teamData = await programHelper.viewTeamData(teamName);
  if (!teamData) {
    return res.json([]); // Return empty if team not found
  }
  // 🔹 If General Zone is requested, merge all members from every zone
  if (zone === "General") {
    const allMembers = [];
    // Loop through all possible zone keys
    ["Pre Zone", "Mid Zone", "High Zone"].forEach(z => {
      if (Array.isArray(teamData[z])) {
        allMembers.push(...teamData[z]);
      }
    });
    return res.json(allMembers);
  }
  // 🔹 Otherwise return only the requested zone members
  const zoneMembers = teamData[zone] || [];
  res.json(zoneMembers);
});

router.post("/add-call-list", requireAuth, async (req, res) => {
  const {program,team,member}=req.body
  let members = member;
if (!Array.isArray(members)) {
  members = [members]; // make it always an array
}
  await callListHelper.addToCallList(program,team,members);

   let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teams = await programHelper.viewAllTeamData();
  var programs = await programHelper.viewPrograms();
   let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    callListData.forEach((prog) => {
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team
      }));
    });
    
  res.render("admin/call-list", { admin: true, codeLetter: true, fName, teams, programs ,groupedCallList});
});

router.get("/code-letter-add", requireAuth, async(req,res)=>{
  
   let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var programs = await programHelper.viewPrograms();
   let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    callListData.forEach((prog) => {
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team
      }));
    });
  res.render("admin/code-letter-add",{admin:true, fName, programs ,groupedCallList});
});

router.post('/add-code-letter', requireAuth, async(req,res)=>{
  const { program } = req.body;
    const codes = [];
    // Convert the nested form data into an array
    for (let key in req.body) {
      if (key.startsWith("codes")) {
        const match = key.match(/codes\[(\d+)\]\[(.*?)\]/);
        if (match) {
          const index = parseInt(match[1]);
          const field = match[2];
          if (!codes[index]) codes[index] = {};
          codes[index][field] = req.body[key];
        }
      }
    }
    const result = await callListHelper.addCodeLetter(program, codes);
    res.send(result); // sending simple response object (like your other routes)
});

router.get("/edit-result", requireAuth, async(req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var programs = await programHelper.viewCallListPrograms();
  programs = programs.map(p => {
  const [programName, zone] = p.program.split(" - ");
  return {
    programName: programName.trim(),
    zone: zone?.trim()
  };
});
  
res.render("admin/select-program",{admin:true,fName, programs})
});
router.get("/add-point/", requireAuth, async(req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  let {programName, zone}=req.query;
  const programData = `${programName} - ${zone}`; // matches the DB key format
  var codeLetters=await callListHelper.getCodeLetter(programData);
  codeLetters.sort((a, b) => a.codes.localeCompare(b.codes)); //this will sort the codeletter
  res.render("admin/add-point",{admin:true,fName,programName,codeLetters, zone});
});

router.post("/save-points", requireAuth, async(req,res)=>{
  await resultHelper.addPoint(req.body);
  
    res.redirect('/admin/edit-result');
});

router.get("/view-result", requireAuth, async (req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;

  // Check if search query is provided
  const searchQuery = req.query.search;
  let programs;
  
  if (searchQuery && searchQuery.trim().length > 0) {
    programs = await resultHelper.searchResultsByName(searchQuery.trim());
  } else {
    programs = await resultHelper.viewAllResult();
  }

  // Get member points grouped by zone
  const memberPointsByZone = await programHelper.getAllMemberPointsByZone();
  
  // Get teams sorted by total points
  const teamsByPoints = await resultHelper.getAllTeamsSortedByPoints();
  
  // Get published team points data for program count
  const publishedTeamData = await resultHelper.getPublishedTeamPoints();
  const programCount = publishedTeamData.programCount || 0;
 
  res.render("admin/view-results", { admin:true,programs, fName, memberPointsByZone, teamsByPoints, programCount });
})

// API endpoint for AJAX search (optional, for dynamic search without page reload)
router.get("/search-results", requireAuth, async (req,res)=>{
  const searchQuery = req.query.q;
  
  if (!searchQuery || searchQuery.trim().length === 0) {
    return res.json([]);
  }
  
  const programs = await resultHelper.searchResultsByName(searchQuery.trim());
  res.json(programs);
})

// Publish Results Routes
router.get("/publish", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  
  // Initialize pending results if needed (on first visit)
  await resultHelper.initializePendingResults();
  
  // Get pending results
  const pendingResults = await resultHelper.getPendingResults();
  
  // Get published results
  const publishedResults = await resultHelper.getPublishedResults();
  
  // Check if team points are published (but allow re-publishing)
  const collections = require("../config/collections");
  const connectDB = require("../config/db");
  const database = await connectDB();
  const teamPointsPublished = await database.collection(collections.PUBLISHED_TEAM).findOne();
  
  const view = req.query.view || 'pending'; // pending or published
  
  res.render("admin/publish", { 
    admin: true, 
    fName, 
    pendingResults, 
    publishedResults,
    teamPointsPublished: !!teamPointsPublished,
    currentView: view
  });
});

router.post("/publish-program", requireAuth, async (req, res) => {
  try {
    const { programName, zone } = req.body;
    const result = await resultHelper.publishProgram(programName, zone);
    res.json({ 
      success: true, 
      message: `Program "${programName} - ${zone}" published successfully as #${result.publishOrder}!`,
      publishOrder: result.publishOrder
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post("/publish-team-points", requireAuth, async (req, res) => {
  try {
    const result = await resultHelper.publishTeamPoints();
    res.json({ 
      success: true, 
      message: `Team points published successfully! ${result.teamsCount} teams published (After ${result.programCount} program${result.programCount !== 1 ? 's' : ''}).`
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
