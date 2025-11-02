var express = require("express");
var router = express.Router();
const programHelper = require("../helpers/program-helper");
const callListHelper = require("../helpers/callList-helper");
const resultHelper = require("../helpers/result-helper");

/* GET home page. */
router.get("/", (req, res) => {
  res.render("admin/cover", { cover: true });
});

router.get("/enter", async (req, res) => {
  let fName = await programHelper.GetFestName();
  var teams = await programHelper.viewAllTeamData();
  fName = fName[0].festName;
  res.render("admin/home", { admin: true, fName, teams });
});

router.get("/settings", async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teams = await programHelper.viewAllTeamData();
  var programs = await programHelper.viewPrograms();
  res.render("admin/settings", { admin: true, fName, teams, programs });
});

router.post("/update-fest-name", async (req, res) => {
  await programHelper.setFestName(req.body);
});

router.post("/add-team", async (req, res) => {
  var teamName = { ...req.body };
  if (req.body) await programHelper.addTeams(teamName);
  res.redirect("back");
});

router.post("/add-program", async (req, res) => {
  var program = { ...req.body };
  if (program) await programHelper.addPrograms(program);
  res.redirect("/admin/settings");
});

router.get("/add-members/:TName", async (req, res) => {
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

router.post("/add-members/:TName", async (req, res) => {
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  var teamName = req.params.TName;
  var memberDetails = { ...req.body };
  await programHelper.addMember(teamName, memberDetails);

  res.redirect(`/admin/add-members/${teamName}`);
});

router.get("/call-list", async (req, res) => {
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

router.post("/add-call-list", async (req, res) => {
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
    
  res.render("admin/call-list", { admin: true, fName, teams, programs ,groupedCallList});
});

router.get("/code-letter-add",async(req,res)=>{
  
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

router.post('/add-code-letter',async(req,res)=>{
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

router.get("/edit-result",async(req,res)=>{
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
router.get("/add-point/",async(req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;
  let {programName, zone}=req.query;
  const programData = `${programName} - ${zone}`; // matches the DB key format
  var codeLetters=await callListHelper.getCodeLetter(programData);
  codeLetters.sort((a, b) => a.codes.localeCompare(b.codes)); //this will sort the codeletter
  res.render("admin/add-point",{admin:true,fName,programName,codeLetters, zone});
});

router.post("/save-points",async(req,res)=>{
  await resultHelper.addPoint(req.body);
  
    res.redirect('/admin/edit-result');
});

router.get("/view-result",async (req,res)=>{
  let fName = await programHelper.GetFestName();
  fName = fName[0].festName;

  const programs = await resultHelper.viewAllResult();
 console.log(programs);
 
  res.render("admin/view-results", { admin:true,programs, fName });
})
module.exports = router;
