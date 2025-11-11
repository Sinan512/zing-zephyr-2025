const collections=require("../config/collections");
const connectDB = require("../config/db");
const { response } = require("express");
const ObjectId = require("mongodb").ObjectId;

module.exports={
    setFestName:async(festname,callback)=>{
        var db=await connectDB();
        var festTitle=await db.collection(collections.FEST_NAME).find().toArray();
        if(festTitle){
        await db.collection(collections.FEST_NAME).updateOne({festName:festTitle[0].festName},{$set: {festName:festname.festName}}).then((data)=>{
        })
        }
        else{
            await db.collection(collections.FEST_NAME).insertOne(festname).then((data)=>{
        })
        }
    },
    GetFestName:async()=>{
        var db=await connectDB();
        return await db.collection(collections.FEST_NAME).find().toArray();
    },
    addTeams:async(teamData)=>{
        var db=await connectDB();
        var teamName=await db.collection(collections.TEAM_DATA).findOne({teamName:teamData.teamName});
        if(teamName){
            console.log("team exist");
        }
        else{
            await db.collection(collections.TEAM_DATA).insertOne(teamData).then((data)=>{
            })
        }
    },
     viewAllTeamData:async()=>{
        var db=await connectDB();
        return await db.collection(collections.TEAM_DATA).find().toArray();
    },
    removeTeam:async(teamName)=>{
        var db=await connectDB();
        const res = await db.collection(collections.TEAM_DATA).deleteOne({ teamName });
        return res.deletedCount > 0;
    },
    addPrograms:async(programData)=>{
        var db=await connectDB();
        var program=await db.collection(collections.PROGRAMS).findOne({programName:programData.programName});
        if(program){
            console.log("program exist");
        }
        else{
            await db.collection(collections.PROGRAMS).insertOne(programData).then((data)=>{
            })
        }
    },
    viewPrograms:async()=>{
        var db=await connectDB();
        return await db.collection(collections.PROGRAMS).find().toArray();
    },
    removeProgram:async(name,zone)=>{
        var db=await connectDB();
        var res = await db.collection(collections.PROGRAMS).deleteOne({ programName:name });
        var programKey = `${name} - ${zone}`;
        await db.collection(collections.CALL_LISTS).deleteOne({  program: programKey  });
        return res.deletedCount > 0;
        },
    viewCallListPrograms:async()=>{
        var db=await connectDB();
        return await db.collection(collections.CALL_LISTS).find().toArray();
    },
    addMember:async(teamName,memberData)=>{
        const {memberName,zone}=memberData;
        var db=await connectDB();
        await db.collection(collections.TEAM_DATA).updateOne({teamName:teamName},{$push:{[zone]:{member:memberName}}});
    },
    viewTeamData:async(teamName)=>{
        var db=await connectDB();
        return await db.collection(collections.TEAM_DATA).findOne({teamName:teamName});
    },
    removeMember:async(teamName, memberName, zone)=>{
        var db=await connectDB();
        const result = await db.collection(collections.TEAM_DATA).updateOne(
            { teamName: teamName },
            { $pull: { [zone]: { member: memberName } } }
        );
        return result.modifiedCount > 0;
    },
    getAllMemberPointsByZone:async()=>{
        var db=await connectDB();
        const docs = await db.collection(collections.INDIVIDUAL_POINTS).find().toArray();

        // Get all Individual program results to count programs per member
        const allResults = await db.collection(collections.RESULTS).find().toArray();
        const allPrograms = await db.collection(collections.PROGRAMS).find().toArray();
        const programMap = {};
        allPrograms.forEach(p => {
            programMap[p.programName] = { zone: p.zone, type: p.programType };
        });

        // Count programs per member per zone
        const programCounts = {};
        allResults.forEach(result => {
            const prog = programMap[result.programName];
            if (!prog || prog.type !== "Individual") return;
            const zone = prog.zone === "General" ? null : prog.zone;
            if (!zone || !["Pre Zone", "Mid Zone", "High Zone"].includes(zone)) return;
            
            if (result.results && Array.isArray(result.results)) {
                result.results.forEach(r => {
                    const key = `${r.participant}|${r.team}|${zone}`;
                    if (!programCounts[key]) programCounts[key] = 0;
                    programCounts[key]++;
                });
            }
        });

        // Prepare accumulators for both display keys and fallback keys used in templates
        const agg = {
            "Pre Zone": {},
            "Mid Zone": {},
            "High Zone": {},
            preZone: {},
            midZone: {},
            highZone: {}
        };

        // Support two schemas:
        // A) Flat documents: { participant, team, zone, totalMark }
        // B) Single doc with arrays: { "Pre Zone": [ { member, team, totalMark }, ...], ... }
        for (const doc of docs) {
            if (doc["Pre Zone"] || doc["Mid Zone"] || doc["High Zone"]) {
                // Nested arrays schema (B)
                ["Pre Zone", "Mid Zone", "High Zone"].forEach(z => {
                    const arr = Array.isArray(doc[z]) ? doc[z] : [];
                    for (const m of arr) {
                        const key = `${m.member}|${m.team}`;
                        if (!agg[z][key]) {
                            agg[z][key] = { member: m.member, team: m.team, points: 0, programCount: 0 };
                        }
                        agg[z][key].points += m.totalMark || 0;
                    }
                });
            } else if (doc.zone && doc.participant) {
                // Flat per-member schema (A)
                const z = doc.zone;
                if (["Pre Zone", "Mid Zone", "High Zone"].includes(z)) {
                    const key = `${doc.participant}|${doc.team}`;
                    if (!agg[z][key]) {
                        agg[z][key] = { member: doc.participant, team: doc.team, points: 0, programCount: 0 };
                    }
                    agg[z][key].points += doc.totalMark || 0;
                }
            }
        }

        // Add program counts to each member
        Object.keys(agg).forEach(zoneKey => {
            if (["Pre Zone", "Mid Zone", "High Zone"].includes(zoneKey)) {
                Object.keys(agg[zoneKey]).forEach(memberKey => {
                    const member = agg[zoneKey][memberKey];
                    const countKey = `${member.member}|${member.team}|${zoneKey}`;
                    member.programCount = programCounts[countKey] || 0;
                });
            }
        });

        // Build final arrays and alias to alternative keys expected by templates
        const finalZoneData = {
            "Pre Zone": Object.values(agg["Pre Zone"]).sort((a,b)=>b.points-a.points),
            "Mid Zone": Object.values(agg["Mid Zone"]).sort((a,b)=>b.points-a.points),
            "High Zone": Object.values(agg["High Zone"]).sort((a,b)=>b.points-a.points),
            preZone: [],
            midZone: [],
            highZone: []
        };
        finalZoneData.preZone = finalZoneData["Pre Zone"]; // alias
        finalZoneData.midZone = finalZoneData["Mid Zone"]; // alias
        finalZoneData.highZone = finalZoneData["High Zone"]; // alias

        return finalZoneData;
    },
    resetData:async()=>{
        let db=await connectDB();
        await db.dropDatabase();
    }
}
