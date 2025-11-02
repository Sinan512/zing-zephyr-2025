const collections=require("../config/collections");
const connectDB = require("../config/db");
const { response } = require("express");
const ObjectId = require("mongodb").ObjectId;

// helpers/resultHelper.js
module.exports = {
  addPoint: async (body) => {
    const db = await connectDB();
    const { programName, zone } = body;

    // 1️⃣ Get maxMark from PROGRAMS
    const programData = await db.collection(collections.PROGRAMS).findOne({ programName });
    if (!programData) throw new Error("Program not found in PROGRAMS collection.");
    const maxMark = programData.maxMark;

    // 2️⃣ Get participants from CALL_LISTS
    const callList = await db.collection(collections.CALL_LISTS).findOne({ program: programName+" - "+zone });
    if (!callList) throw new Error("Program not found in CALL_LISTS collection.");
    const participants = callList.participants || [];

    // 3️⃣ Parse points (points[A], points[B] ...)
    const pointsMap = {};
    Object.keys(body).forEach((key) => {
      if (key.startsWith("points[")) {
        const code = key.match(/points\[(.*?)\]/)[1];
        pointsMap[code] = parseFloat(body[key]);
      }
    });

    // 4️⃣ Grade and Mark Tables
    const markTable = {
      11: { Aplus: 6, A: 5, B: 3, C: 1 },
      15: { Aplus: 10, A: 9, B: 6, C: 3 },
      20: { Aplus: 15, A: 12, B: 8, C: 4 },
      25: { Aplus: 20, A: 16, B: 10, C: 6 },
    };
    const marksSet = markTable[maxMark] || markTable[20];

    function getGradeAndMark(point) {
      const percentage = point; // point already 0–100
      let grade = "No Grade";
      let mark = 0;
      if (percentage >= 90) { grade = "A+"; mark = marksSet.Aplus; }
      else if (percentage >= 70) { grade = "A"; mark = marksSet.A; }
      else if (percentage >= 60) { grade = "B"; mark = marksSet.B; }
      else if (percentage >= 50) { grade = "C"; mark = marksSet.C; }
      return { grade, mark };
    }

    // 5️⃣ Build Results Array
    const results = participants.map((p) => {
      const code = p.codes;
      const point = pointsMap[code] || 0;
      const { grade, mark } = getGradeAndMark(point);
      return {
        codes: code,
        participant: p.participant,
        team: p.team,
        grade,
        mark,
        point,
      };
    });

    // 6️⃣ Sort and Apply Bonus (+5, +3, +1)
    const sorted = [...results].sort((a, b) => b.point - a.point);
    if (sorted.length > 0) {
      const top1 = sorted[0].point;
      const top2 = sorted[1]?.point;
      const top3 = sorted[2]?.point;

      results.forEach((r) => {
        if (r.point === top1) r.mark += 5;
        else if (r.point === top2) r.mark += 3;
        else if (r.point === top3) r.mark += 1;
      });
    }

    // 7️⃣ Save to RESULTS
    await db.collection(collections.RESULTS).updateOne(
      { programName, zone },
      { $set: { programName, zone, results } },
      { upsert: true }
    );

   // 8️⃣ Update TEAM_POINTS totals (aggregated by team + program + zone)
const teamTotals = {};

for (const r of results) {
  const { team, mark } = r;

  // Count team total for this program + zone
  if (!teamTotals[team]) teamTotals[team] = 0;
  teamTotals[team] += mark;
}

// Update each team once per program
for (const [team, totalMark] of Object.entries(teamTotals)) {
  await db.collection(collections.TEAM_POINTS).updateOne(
    { team, "programs.programName": programName, "programs.zone": zone },
    {
      $set: { "programs.$.totalMark": totalMark },
      $inc: { totalPoints: totalMark },
    },
    { upsert: false }
  );

  // If program entry doesn't exist, push it
  const teamDoc = await db.collection(collections.TEAM_POINTS).findOne({
    team,
    "programs.programName": programName,
    "programs.zone": zone,
  });

  if (!teamDoc) {
    await db.collection(collections.TEAM_POINTS).updateOne(
      { team },
      {
        $push: { programs: { programName, zone, totalMark } },
        $inc: { totalPoints: totalMark },
      },
      { upsert: true }
    );
  }
}

// 9️⃣ Update each member's total points in TEAM_DATA (only for Individual programs)
for (const r of results) {
  const { participant, team, mark, programName } = r;

  // 🔹 Fetch the program document to check its type
  const programDoc = await db.collection(collections.PROGRAMS).findOne({ programName });
  if (!programDoc) {
    console.warn(`⚠️ Program "${programName}" not found, skipping member update.`);
    continue;
  }

  // 🔹 Skip if the program type is Group
  if (programDoc.programType === "Group") {
    console.log(`⏩ Skipped member update for Group program "${programName}".`);
    continue;
  }

  // 🔹 Continue only for Individual programs
  const zone = programDoc.zone;
  const teamDoc = await db.collection(collections.TEAM_DATA).findOne({ teamName: team });
  if (!teamDoc) continue;

  let memberFound = false;

  // --- For specific zones ---
  if (zone !== "General") {
    const filter = { teamName: team };
    filter[`${zone}.member`] = participant;

    const update = { $inc: { [`${zone}.$.point`]: mark } };

    const result = await db.collection(collections.TEAM_DATA).updateOne(filter, update);

    if (result.modifiedCount > 0) {
      console.log(`✅ Added ${mark} to ${participant} in ${zone}`);
      memberFound = true;
    }
  }

  // --- For General programs ---
  else {
    for (const z of ["Pre Zone", "Mid Zone", "High Zone"]) {
      const filter = { teamName: team };
      filter[`${z}.member`] = participant;

      const update = { $inc: { [`${z}.$.point`]: mark } };

      const result = await db.collection(collections.TEAM_DATA).updateOne(filter, update);

      if (result.modifiedCount > 0) {
        memberFound = true;
        break;
      }
    }
  }

  if (!memberFound) {
    console.warn(`⚠️ Member ${participant} not found in team ${team}`);
  }
}

  await db.collection(collections.CALL_LISTS).deleteOne({ program: programName+" - "+zone });

    console.log("✅ addResult() completed successfully!");
  },
  viewAllResult:async()=>{
    var db=await connectDB();
    return await db.collection(collections.RESULTS).find().toArray();
  },
  searchResultsByName:async(searchQuery)=>{
    var db=await connectDB();
    // Case-insensitive search for program name
    const regex = new RegExp(searchQuery, 'i');
    return await db.collection(collections.RESULTS).find({
      programName: { $regex: regex }
    }).toArray();
  },
  viewTeamStatus:async()=>{
    var db=await connectDB();
    return await db.collection(collections.TEAM_POINTS).find().toArray();
  },
  getAllTeamsSortedByPoints:async()=>{
    var db=await connectDB();
    const teams = await db.collection(collections.TEAM_POINTS).find().toArray();
    
    // Sort teams by totalPoints (descending - highest first)
    const sortedTeams = teams
      .map(team => ({
        team: team.team,
        totalPoints: team.totalPoints || 0
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    
    return sortedTeams;
  },
  // Initialize pending results from all results
  initializePendingResults:async()=>{
    var db=await connectDB();
    const allResults = await db.collection(collections.RESULTS).find().toArray();
    
    // Check if pending results already initialized
    const existingCount = await db.collection(collections.PENDING_RESULTS).countDocuments();
    if (existingCount > 0) {
      return { message: "Pending results already initialized", count: existingCount };
    }
    
    // Add all results to pendingResults
    if (allResults.length > 0) {
      await db.collection(collections.PENDING_RESULTS).insertMany(allResults);
    }
    
    return { message: "Pending results initialized", count: allResults.length };
  },
  // Get pending results with team points for each program
  getPendingResults:async()=>{
    var db=await connectDB();
    const pending = await db.collection(collections.PENDING_RESULTS).find().toArray();
    
    // Get team points to calculate per-program totals
    const teamPoints = await db.collection(collections.TEAM_POINTS).find().toArray();
    
    // Add team point totals for each program
    const resultsWithTeamPoints = pending.map(result => {
      const programTeamPoints = {};
      
      // Calculate team points from results
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach(r => {
          if (!programTeamPoints[r.team]) {
            programTeamPoints[r.team] = 0;
          }
          programTeamPoints[r.team] += r.mark || 0;
        });
      }
      
      return {
        ...result,
        teamPoints: programTeamPoints
      };
    });
    
    return resultsWithTeamPoints;
  },
  // Publish a program result
  publishProgram:async(programName, zone)=>{
    var db=await connectDB();
    
    // Get the result from pending
    const pendingResult = await db.collection(collections.PENDING_RESULTS).findOne({
      programName: programName,
      zone: zone
    });
    
    if (!pendingResult) {
      throw new Error("Program result not found in pending results");
    }
    
    // Get next publish order number
    const publishedCount = await db.collection(collections.PUBLISHED).countDocuments();
    const publishOrder = publishedCount + 1;
    
    // Add to published collection with order number
    await db.collection(collections.PUBLISHED).insertOne({
      ...pendingResult,
      publishOrder: publishOrder,
      publishedAt: new Date()
    });
    
    // Remove from pending
    await db.collection(collections.PENDING_RESULTS).deleteOne({
      programName: programName,
      zone: zone
    });
    
    return { success: true, publishOrder };
  },
  // Get published results
  getPublishedResults:async()=>{
    var db=await connectDB();
    const published = await db.collection(collections.PUBLISHED).find().sort({ publishOrder: 1 }).toArray();
    
    // Add team point totals for each program
    const resultsWithTeamPoints = published.map(result => {
      const programTeamPoints = {};
      
      // Calculate team points from results
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach(r => {
          if (!programTeamPoints[r.team]) {
            programTeamPoints[r.team] = 0;
          }
          programTeamPoints[r.team] += r.mark || 0;
        });
      }
      
      return {
        ...result,
        teamPoints: programTeamPoints
      };
    });
    
    return resultsWithTeamPoints;
  },
  // Publish team points
  publishTeamPoints:async()=>{
    var db=await connectDB();
    
    // Check if already published
    const existing = await db.collection(collections.PUBLISHED_TEAM).findOne();
    if (existing) {
      throw new Error("Team points already published");
    }
    
    // Get current team points
    const teamPoints = await db.collection(collections.TEAM_POINTS).find().toArray();
    
    // Sort by total points
    const sortedTeams = teamPoints
      .map(team => ({
        team: team.team,
        totalPoints: team.totalPoints || 0,
        programs: team.programs || []
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Add to published team collection
    await db.collection(collections.PUBLISHED_TEAM).insertOne({
      teams: sortedTeams,
      publishedAt: new Date()
    });
    
    return { success: true, teamsCount: sortedTeams.length };
  }
};
