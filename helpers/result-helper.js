const collections=require("../config/collections");
const connectDB = require("../config/db");
const { response } = require("express");
const ObjectId = require("mongodb").ObjectId;

// helpers/resultHelper.js
module.exports = {
 addPoint: async (body) => {
  const db = await connectDB();
  let { programName, zone } = body;

  // Clean the zone a bit (case-insensitive match later if needed)
  const cleanZone = zone.trim();

  // Normalization: remove ALL whitespace and lowercase
  const normalize = (str) => {
    if (!str) return "";
    return str.replace(/\s+/g, "").toLowerCase();
  };

  const targetNameNorm = normalize(programName);

  // 1️⃣ Get all programs in this zone (usually small list)
  const programsInZone = await db
    .collection(collections.PROGRAMS)
    .find({
      zone: {
        $regex: "^" + cleanZone + "$",
        $options: "i", // case-insensitive zone match
      },
    })
    .toArray();

  // 2️⃣ Find the program whose normalized name matches the incoming one
  const programData = programsInZone.find(
    (p) => normalize(p.programName) === targetNameNorm
  );

  console.log("Matched Program:", programData);

  if (!programData) throw new Error( `Program not found in PROGRAMS collection for name "${programName}" and zone "${zone}"`
);

// 👇 IMPORTANT: Update values to TRUE DB versions
programName = programData.programName;
zone = programData.zone;

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
    // 7️⃣.5 Save to pending
    await db.collection(collections.PENDING_RESULTS).updateOne(
      { programName, zone },
      { $set: { programName, zone, results } },
      { upsert: true }
    );

   // 8️⃣ Update TEAM_POINTS totals (aggregated by team + program + zone)
// ✅ 1. Build totals for each team for THIS program + zone
const teamTotals = {};

for (const r of results) {
  const { team, mark } = r;
  if (!teamTotals[team]) teamTotals[team] = 0;
  teamTotals[team] += mark;
}

// ✅ 2. Update every team for this program
for (const [team, newMark] of Object.entries(teamTotals)) {

  // Fetch team document
  const teamDoc = await db.collection(collections.TEAM_POINTS).findOne({ team });

  // ✅ If team doesn't exist, create fresh document
  if (!teamDoc) {
    await db.collection(collections.TEAM_POINTS).insertOne({
      team,
      totalPoints: newMark,
      programs: [
        { programName, zone, totalMark: newMark }
      ]
    });
    continue;
  }

  // ✅ Check if this program already exists for this team
  const existingProgram = teamDoc.programs.find(
    p => p.programName === programName && p.zone === zone
  );

  if (existingProgram) {
    // ✅ Program already exists → update using difference
    const oldMark = existingProgram.totalMark;
    const diff = newMark - oldMark; // ⬅️ important

    await db.collection(collections.TEAM_POINTS).updateOne(
      {
        team,
        "programs.programName": programName,
        "programs.zone": zone
      },
      {
        $set: { "programs.$.totalMark": newMark },
        $inc: { totalPoints: diff } // ✅ only add diff
      }
    );

  } else {
    // ✅ Program does NOT exist → insert new entry
    await db.collection(collections.TEAM_POINTS).updateOne(
      { team },
      {
        $push: { programs: { programName, zone, totalMark: newMark } },
        $inc: { totalPoints: newMark } // ✅ add full mark once
      }
    );
  }
}

// 9️⃣ Update each member's total marks in INDIVIDUAL_POINTS (for Individual programs only)
for (const r of results) {
  const { participant, team, mark } = r;

  // 🔹 Fetch the program document to check its type & zone
  const programDoc = await db.collection(collections.PROGRAMS).findOne({ programName });
  if (!programDoc) {
    console.warn(`⚠️ Program "${programName}" not found, skipping member update.`);
    continue;
  }

  // 🔹 Skip Group programs
  if (programDoc.programType === "Group") {
    console.log(`⏩ Skipped member update for Group program "${programName}".`);
    continue;
  }

  // Determine the target zone(s)
  let targetZones = [];

  if (programDoc.zone !== "General") {
    // For Pre/Mid/High Zone programs, direct update
    targetZones = [programDoc.zone];
  } else {
    // For General programs — find actual zone of this member
    const teamDoc = await db.collection(collections.TEAM_DATA).findOne({ teamName: team });
    if (teamDoc) {
      for (const z of ["Pre Zone", "Mid Zone", "High Zone"]) {
        if (Array.isArray(teamDoc[z])) {
          const exists = teamDoc[z].some(m => m.member === participant);
          if (exists) {
            targetZones.push(z);
            break; // member exists in only one zone
          }
        }
      }
    }
  }

  if (targetZones.length === 0) {
    console.warn(`⚠️ Zone not found for ${participant} (${team})`);
    continue;
  }

  // 🔹 Ensure INDIVIDUAL_POINTS doc exists
  const individualDoc = await db.collection(collections.INDIVIDUAL_POINTS).findOne({});
  if (!individualDoc) {
    await db.collection(collections.INDIVIDUAL_POINTS).insertOne({
      "Pre Zone": [],
      "Mid Zone": [],
      "High Zone": []
    });
  }

  // 🔹 Update each target zone in INDIVIDUAL_POINTS
  for (const zone of targetZones) {
    // Try to update existing member’s mark
    const updateResult = await db.collection(collections.INDIVIDUAL_POINTS).updateOne(
      { [`${zone}.member`]: participant },
      { $inc: { [`${zone}.$.totalMark`]: mark } }
    );

    // If member not found, push new entry
    if (updateResult.matchedCount === 0) {
      await db.collection(collections.INDIVIDUAL_POINTS).updateOne(
        {},
        { $push: { [zone]: { member: participant, team: team, totalMark: mark } } }
      );
    }

    console.log(`✅ Added ${mark} marks to ${participant} (${team}, ${zone}) in INDIVIDUAL_POINTS`);
  }
}
//ended

  await db.collection(collections.CALL_LISTS).deleteOne({ program: programName+" - "+zone });

    console.log("✅ addResult() completed successfully!");
  },
  // Initialize individual points from existing results (one-time migration)
  initializeIndividualPoints:async()=>{
    var db=await connectDB();
    
    // Get all results from RESULTS collection
    const allResults = await db.collection(collections.RESULTS).find().toArray();
    
    // Clear existing individual points (optional - comment out if you want to preserve)
    // await db.collection(collections.INDIVIDUAL_POINTS).deleteMany({});
    
    let processedCount = 0;
    
    for (const resultDoc of allResults) {
      const { programName, zone, results } = resultDoc;
      
      if (!results || !Array.isArray(results)) continue;
      
      // Get program type
      const programDoc = await db.collection(collections.PROGRAMS).findOne({ programName });
      if (!programDoc || programDoc.programType !== "Individual") continue;
      
      const programZone = programDoc.zone;
      
      // Process each participant result
      for (const r of results) {
        const { participant, team, mark } = r;
        
        if (programZone !== "General") {
          await db.collection(collections.INDIVIDUAL_POINTS).updateOne(
            {
              participant: participant,
              team: team,
              zone: programZone
            },
            {
              $inc: { totalMark: mark || 0 },
              $setOnInsert: {
                participant: participant,
                team: team,
                zone: programZone,
                totalMark: mark || 0
              }
            },
            { upsert: true }
          );
        } else {
          // For General programs, try to find member in teamData
          const teamDoc = await db.collection(collections.TEAM_DATA).findOne({ teamName: team });
          if (teamDoc) {
            for (const z of ["Pre Zone", "Mid Zone", "High Zone"]) {
              if (Array.isArray(teamDoc[z])) {
                const memberExists = teamDoc[z].some(m => m.member === participant);
                if (memberExists) {
                  await db.collection(collections.INDIVIDUAL_POINTS).updateOne(
                    {
                      participant: participant,
                      team: team,
                      zone: z
                    },
                    {
                      $inc: { totalMark: mark || 0 },
                      $setOnInsert: {
                        participant: participant,
                        team: team,
                        zone: z,
                        totalMark: mark || 0
                      }
                    },
                    { upsert: true }
                  );
                  break;
                }
              }
            }
          }
        }
        processedCount++;
      }
    }
    
    return { message: "Individual points initialized", count: processedCount };
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
  // Get pending results with team points for each program (excluding already published)
  getPendingResults:async()=>{
    var db=await connectDB();
    
    // Get all published programs to exclude from pending
    const published = await db.collection(collections.PUBLISHED).find().toArray();
    const publishedKeys = new Set(published.map(p => `${p.programName}|${p.zone}`));
    
    // Get all pending results
    const allPending = await db.collection(collections.PENDING_RESULTS).find().toArray();
    
    // Filter out already published programs
    const pending = allPending.filter(result => {
      const key = `${result.programName}|${result.zone}`;
      return !publishedKeys.has(key);
    });
    
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
  // Get published results with only top 3 for user display (handling ties)
  getPublishedResultsTop3:async()=>{
    var db=await connectDB();
    const published = await db.collection(collections.PUBLISHED).find().sort({ publishOrder: 1 }).toArray();
    
    // Process each program to show only top 3 with ties
    const resultsTop3 = published.map(result => {
      let top3 = [];
      if (result.results && Array.isArray(result.results)) {
        const sorted = [...result.results].sort((a, b) => (b.point || 0) - (a.point || 0));
        
        if (sorted.length > 0) {
          // Get unique point values in descending order
          const uniquePoints = [...new Set(sorted.map(r => r.point || 0))].sort((a, b) => b - a);
          
          // Get all participants for 1st, 2nd, 3rd positions (handling ties)
          const firstPoint = uniquePoints[0];
          const secondPoint = uniquePoints[1];
          const thirdPoint = uniquePoints[2];
          
          // First place (all with highest points)
          sorted.filter(r => (r.point || 0) === firstPoint).forEach(r => {
            top3.push({ participant: r.participant, team: r.team, position: 1 });
          });
          
          // Second place (all with second highest points)
          if (secondPoint !== undefined && top3.length < 10) {
            sorted.filter(r => (r.point || 0) === secondPoint).forEach(r => {
              top3.push({ participant: r.participant, team: r.team, position: 2 });
            });
          }
          
          // Third place (all with third highest points)
          if (thirdPoint !== undefined && top3.length < 10) {
            sorted.filter(r => (r.point || 0) === thirdPoint).forEach(r => {
              top3.push({ participant: r.participant, team: r.team, position: 3 });
            });
          }
          
          // Limit to max 20 entries (to handle many ties)
          top3 = top3.slice(0, 20);
        }
      }
      
      return {
        programName: result.programName,
        zone: result.zone,
        publishOrder: result.publishOrder,
        top3: top3
      };
    });
    
    return resultsTop3;
  },
  // Publish team points (can be called multiple times, recalculates from published programs)
  publishTeamPoints:async()=>{
    var db=await connectDB();
    
    // Get all published programs
    const published = await db.collection(collections.PUBLISHED).find().sort({ publishOrder: 1 }).toArray();
    const programCount = published.length;
    
    // Calculate team points from published programs
    const teamPointsMap = {};
    
    published.forEach(result => {
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach(r => {
          if (!teamPointsMap[r.team]) {
            teamPointsMap[r.team] = 0;
          }
          teamPointsMap[r.team] += r.mark || 0;
        });
      }
    });
    
    // Convert to array and sort
    const sortedTeams = Object.keys(teamPointsMap)
      .map(team => ({
        team: team,
        totalPoints: teamPointsMap[team],
        programCount: programCount
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    
    // Delete existing published team points if any
    await db.collection(collections.PUBLISHED_TEAM).deleteMany({});
    
    // Add to published team collection
    await db.collection(collections.PUBLISHED_TEAM).insertOne({
      teams: sortedTeams,
      programCount: programCount,
      publishedAt: new Date()
    });
    
    return { success: true, teamsCount: sortedTeams.length, programCount: programCount };
  },
  // Get published team points with program count
  getPublishedTeamPoints:async()=>{
    var db=await connectDB();
    const publishedTeamData = await db.collection(collections.PUBLISHED_TEAM).findOne();
    if (publishedTeamData) {
      return {
        teams: publishedTeamData.teams || [],
        programCount: publishedTeamData.programCount || 0,
        publishedAt: publishedTeamData.publishedAt
      };
    }
    return { teams: [], programCount: 0 };
  },
  // Publish zone toppers (similar to team points)
  publishZoneToppers:async()=>{
    var db=await connectDB();
    const programHelper = require("./program-helper");
    const zoneData = await programHelper.getAllMemberPointsByZone();
    
    // Delete existing published zone toppers
    await db.collection(collections.PUBLISHED_ZONE_TOPPERS).deleteMany({});
    
    // Add to published zone toppers collection
    await db.collection(collections.PUBLISHED_ZONE_TOPPERS).insertOne({
      preZone: zoneData["Pre Zone"] || [],
      midZone: zoneData["Mid Zone"] || [],
      highZone: zoneData["High Zone"] || [],
      publishedAt: new Date()
    });
    
    return { success: true, message: "Zone toppers published successfully" };
  },
  // Get published zone toppers
 getPublishedZoneToppers: async () => {
  const db = await connectDB();
  const publishedZoneToppers = await db.collection(collections.PUBLISHED_ZONE_TOPPERS).findOne();

  if (publishedZoneToppers) {
    // Helper function to get the highest scorer from a list
    const getTopper = (zoneList) => {
      if (!Array.isArray(zoneList) || zoneList.length === 0) return null;
      return zoneList.reduce((top, current) =>
        current.points > top.points ? current : top
      );
    };

    return {
      preZone: getTopper(publishedZoneToppers.preZone),
      midZone: getTopper(publishedZoneToppers.midZone),
      highZone: getTopper(publishedZoneToppers.highZone),
      publishedAt: publishedZoneToppers.publishedAt
    };
  }

  return null;
}
};
