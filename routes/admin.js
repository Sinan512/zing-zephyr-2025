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
// Initialize separate add-point credentials
authHelper.initializeAddPoint();
// Initialize separate add-code letter credentials
authHelper.initializeAddCodeLetter();

// Middleware for add-point separate auth
const requireAddPointAuth = async (req, res, next) => {
  if (!authHelper.isAddPointSessionValid(req)) {
    return res.redirect(`/admin/add-point-login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
};

// Middleware for add-code letter separate auth
const requireAddCodeLetterAuth = async (req, res, next) => {
  if (!authHelper.isAddCodeLetterSessionValid(req)) {
    return res.redirect(`/admin/add-code-letter-login?redirect=${encodeURIComponent(req.originalUrl)}`);//pending to set
  }
  next();
};

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
  const currentView = req.query.view || 'teams';
  res.render("admin/settings", { admin: true, fName, teams, programs, success, error, currentView });
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

// Reset Add-Point credentials (separate)
router.post("/reset-addpoint-credentials", requireAuth, async (req, res) => {
  try {
    const { username, password } = req.body;
    await authHelper.updateAddPoint(username, password);
    res.redirect("/admin/settings?success=Add-Point credentials updated successfully");
  } catch (error) {
    res.redirect("/admin/settings?error=Failed to update Add-Point credentials");
  }
});

// Reset Add-Code Letter credentials (separate)
router.post("/reset-addcodeletter-credentials", requireAuth, async (req, res) => {
  try {
    const { username, password } = req.body;
    await authHelper.updateAddCodeLetter(username, password);
    res.redirect("/admin/settings?success=Add-code letter credentials updated successfully");
  } catch (error) {
    res.redirect("/admin/settings?error=Failed to update Add-code letter credentials");
  }
});


router.post("/add-team", requireAuth, async (req, res) => {
  let teamName = { ...req.body };
  teamName.teamName=teamName.teamName.toUpperCase();
  if (req.body) await programHelper.addTeams(teamName);
  res.redirect("back");
});

// Remove team
router.post("/remove-team", requireAuth, async (req, res) => {
  try {
    const { teamName } = req.body;
    const ok = await programHelper.removeTeam(teamName);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1)) {
      return res.json({ success: ok });
    }
    res.redirect("/admin/settings");
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/add-program", requireAuth, async (req, res) => {
  var program = { ...req.body };
  if (program) await programHelper.addPrograms(program);
  res.redirect("/admin/settings");
});

// Remove program
router.post("/remove-program", requireAuth, async (req, res) => {
  try {
    const {programName} = req.body;
    let [name,zone]=programName.split(" - ")
    const ok = await programHelper.removeProgram(name,zone);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1)) {
      return res.json({ success: ok });
    }
    res.redirect("/admin/settings");
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
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

router.post("/remove-member", requireAuth, async (req, res) => {
  try {
    const { memberName, teamName, zone } = req.body;
    const success = await programHelper.removeMember(teamName, memberName, zone);
    
    if (success) {
      res.json({ success: true, message: `Member "${memberName}" removed successfully from ${teamName}` });
    } else {
      res.json({ success: false, message: "Failed to remove member. Member may not exist." });
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.get("/call-list", requireAuth, async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teams = await programHelper.viewAllTeamData();
  var programs = await programHelper.viewPrograms();
  let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    // Create a map of program types: "ProgramName - Zone" -> programType
    const programTypeMap = {};
    programs.forEach((p) => {
      const key = `${p.programName} - ${p.zone}`;
      programTypeMap[key] = p.programType;
    });
    
    callListData.forEach((prog) => {
      // Get program type for this program
      const programType = programTypeMap[prog.program] || null;
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team,
        programType: programType // Add program type to each participant
      }));
    });
  res.render("admin/call-list", { admin: true,codeLetter:true, fName, teams, programs ,groupedCallList, programTypeMap});
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
    // Create a map of program types: "ProgramName - Zone" -> programType
    const programTypeMap = {};
    programs.forEach((p) => {
      const key = `${p.programName} - ${p.zone}`;
      programTypeMap[key] = p.programType;
    });
    
    callListData.forEach((prog) => {
      // Get program type for this program
      const programType = programTypeMap[prog.program] || null;
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team,
        programType: programType // Add program type to each participant
      }));
    });
    
  res.redirect("/admin/call-list");
});

router.post("/remove-call-list-member", requireAuth, async (req, res) => {
  try {
    const { program, member, team } = req.body;
    const success = await callListHelper.removeCallListMember(program, member, team);
    if (success) {
      res.redirect("/admin/call-list");
    } else {
      res.redirect("/admin/call-list?error=Failed to remove member");
    }
  } catch (error) {
    res.redirect("/admin/call-list?error=" + error.message);
  }
});

router.get("/code-letter-add",requireAuth, async(req,res)=>{
  
   let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  let programs = await programHelper.viewPrograms();
   let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    callListData.forEach((prog) => {
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team,
        codes:p.codes
      }));
    });
   let codeletterAdded = {};
  Object.keys(groupedCallList).forEach(program => {
  codeletterAdded[program] = groupedCallList[program].some(p => p.codes);
  });
  res.render("admin/code-letter-add",{admin:true, fName, programs ,codeletterAdded,groupedCallList});
});
//code letter add page with login
router.get("/code-letter-add-login",requireAddCodeLetterAuth, async(req,res)=>{
  
   let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var programs = await programHelper.viewPrograms();
   let callListData = await callListHelper.viewCallList();
    let groupedCallList = {};
    callListData.forEach((prog) => {
      // Convert participant objects for Handlebars
      groupedCallList[prog.program] = prog.participants.map((p) => ({
        member: p.participant, // rename for template
        team: p.team,
        codes:p.codes
      }));
    });
    let codeletterAdded = {};
  Object.keys(groupedCallList).forEach(program => {
  codeletterAdded[program] = groupedCallList[program].some(p => p.codes);
  });
  res.render("admin/code-letter-add",{fName, programs ,codeletterAdded,groupedCallList});
});

router.post('/add-code-letter', async(req,res)=>{
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
  var allPrograms = await programHelper.viewCallListPrograms();
  // Filter only programs that have code letters assigned
  const programsWithCodes = allPrograms.filter(p => {
    if (!p.participants || !Array.isArray(p.participants)) return false;
    return p.participants.some(participant => participant.codes && participant.codes.trim().length > 0);
  });
  programs = programsWithCodes.map(p => {
  const [programName, zone] = p.program.split(" - ");
  return {
    programName: programName.trim(),
    zone: zone?.trim()
  };
});
  
res.render("admin/select-program",{admin:true,fName, programs,codeLetterLog:true})
});

// Add-Point separate login routes
router.get("/add-point-login", async (req, res) => {
  const redirect = req.query.redirect || "";
  res.render("admin/login", { cover: true, addPoint: true, redirect });
});

// Add-Code Letter separate login routes
router.get("/add-code-letter-login", async (req, res) => {
  const redirect = req.query.redirect || "";
  res.render("admin/login", { cover: true, addCodeLetter: true, redirect });
});

router.post("/add-point-login", async (req, res) => {
  const { username, password, redirect: redirectBody } = req.body;
  const isValid = await authHelper.verifyAddPoint(username, password);
  if (isValid) {
    req.session.addPointLoggedIn = true;
    req.session.addPointLastActivity = Date.now();
    const redirect = redirectBody || req.query.redirect || "/admin/edit-result";
    return res.redirect(redirect);
  }
  res.render("admin/login", { cover: true, addPoint: true, error: "Invalid username or password", redirect: redirectBody || req.query.redirect || "" });
});


router.post("/add-code-letter-login", async (req, res) => {
  const { username, password, redirect: redirectBody } = req.body;
  const isValid = await authHelper.verifyAddCodeLetter(username, password);
  if (isValid) {
    req.session.addCodeLetterLoggedIn = true;
    req.session.addCodeLetterLastActivity = Date.now();
    const redirect = redirectBody || req.query.redirect || "/admin/edit-result";
    return res.redirect(redirect);
  }
  res.render("admin/login", { cover: true, addCodeLetter: true, error: "Invalid username or password", redirect: redirectBody || req.query.redirect || "" });
});

router.get("/add-point/", requireAddPointAuth, async(req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  let {programName, zone}=req.query;
  const programData = `${programName} - ${zone}`; // matches the DB key format
  var codeLetters=await callListHelper.getCodeLetter(programData);
  codeLetters.sort((a, b) => a.codes.localeCompare(b.codes)); //this will sort the codeletter
  res.render("admin/add-point",{fName,programName,codeLetters, zone, hideAdminNav: true});
});// pending to set
//add point without login 

router.get("/add-point-noLog/", requireAuth, async(req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  let {programName, zone}=req.query;
  const programData = `${programName} - ${zone}`; // matches the DB key format
  var codeLetters=await callListHelper.getCodeLetter(programData);
  codeLetters.sort((a, b) => a.codes.localeCompare(b.codes)); //this will sort the codeletter
  res.render("admin/add-point",{admin:true,fName,programName,codeLetters, zone});
});

router.post("/save-points", async(req,res)=>{
  try {
    await resultHelper.addPoint(req.body);
    const { programName, zone } = req.body;
    const redirectUrl = `/admin/add-point/?programName=${encodeURIComponent(programName)}&zone=${encodeURIComponent(zone)}&success=true`;
    res.redirect(redirectUrl);
  } catch(error) {
    console.error("Error saving points:", error);
    const { programName, zone } = req.body;
    const redirectUrl = `/admin/add-point/?programName=${encodeURIComponent(programName)}&zone=${encodeURIComponent(zone)}&error=${encodeURIComponent('Failed to save points')}`;
    res.redirect(redirectUrl);
  }
});

//admin save point
router.post("/save-points-admin", async(req,res)=>{
  try {
    await resultHelper.addPoint(req.body);
    const { programName, zone } = req.body;
    const redirectUrl = `/admin/add-point-noLog/?programName=${encodeURIComponent(programName)}&zone=${encodeURIComponent(zone)}&success=true`;
    res.redirect(redirectUrl);
  } catch(error) {
    console.error("Error saving points:", error);
    const { programName, zone } = req.body;
    const redirectUrl = `/admin/add-point-noLog/?programName=${encodeURIComponent(programName)}&zone=${encodeURIComponent(zone)}&error=${encodeURIComponent('Failed to save points')}`;
    res.redirect(redirectUrl);
  }
});

router.get("/view-result", requireAuth, async (req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;

  // Initialize individual points from existing results (one-time, can be called again to update)
  // Uncomment the next line if you want to initialize/update from existing results
  // await resultHelper.initializeIndividualPoints();

  // Check if search query is provided
  const searchQuery = req.query.search;
  let programs;
  
  if (searchQuery && searchQuery.trim().length > 0) {
    programs = await resultHelper.searchResultsByName(searchQuery.trim());
  } else {
    programs = await resultHelper.viewAllResult();
  }

  // Get member points grouped by zone (from INDIVIDUAL_POINTS collection)
  const memberPointsByZone = await programHelper.getAllMemberPointsByZone();
  
  // Get teams sorted by total points
  const teamsByPoints = await resultHelper.getAllTeamsSortedByPoints();
  
  // Get published team points data for program count
  const publishedTeamData = await resultHelper.getPublishedTeamPoints();
  const programCount = publishedTeamData.programCount || 0;
 
  res.render("admin/view-results", { admin:true,programs, fName, memberPointsByZone, teamsByPoints, programCount });
})

router.post("/initialize-individual-points", requireAuth, async (req, res) => {
  try {
    const result = await resultHelper.initializeIndividualPoints();
    res.json({ success: true, message: result.message, count: result.count });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

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

router.post("/publish-zone-toppers", requireAuth, async (req, res) => {
  try {
    const result = await resultHelper.publishZoneToppers();
    res.json({ 
      success: true, 
      message: result.message || "Zone toppers published successfully!"
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
