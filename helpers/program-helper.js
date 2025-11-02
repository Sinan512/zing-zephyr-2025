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
    viewCallListPrograms:async()=>{
        var db=await connectDB();
        return await db.collection(collections.CALL_LISTS).find().toArray();
    },
    addMember:async(teamName,memberData)=>{
        const {memberName,zone}=memberData;
        var db=await connectDB();
        await db.collection(collections.TEAM_DATA).updateOne({teamName:teamName},{$push:{[zone]:{member:memberName,point:0}}});
    },
    viewTeamData:async(teamName)=>{
        var db=await connectDB();
        return await db.collection(collections.TEAM_DATA).findOne({teamName:teamName});
    },
    getAllMemberPointsByZone:async()=>{
        var db=await connectDB();
        const teams = await db.collection(collections.TEAM_DATA).find().toArray();
        
        // Organize members by zone - using both formats for compatibility
        const zoneData = {
            "Pre Zone": [],
            "Mid Zone": [],
            "High Zone": [],
            preZone: [],  // Alternative key without space
            midZone: [],  // Alternative key without space
            highZone: []  // Alternative key without space
        };

        teams.forEach(team => {
            const zones = ["Pre Zone", "Mid Zone", "High Zone"];
            zones.forEach(zone => {
                if (Array.isArray(team[zone])) {
                    team[zone].forEach(member => {
                        const memberData = {
                            member: member.member,
                            team: team.teamName,
                            points: member.point || 0
                        };
                        // Add to both key formats
                        zoneData[zone].push(memberData);
                        // Also add to alternative keys
                        if (zone === "Pre Zone") zoneData.preZone.push(memberData);
                        else if (zone === "Mid Zone") zoneData.midZone.push(memberData);
                        else if (zone === "High Zone") zoneData.highZone.push(memberData);
                    });
                }
            });
        });

        // Sort each zone by points (descending - highest first)
        Object.keys(zoneData).forEach(zone => {
            if (Array.isArray(zoneData[zone])) {
                zoneData[zone].sort((a, b) => b.points - a.points);
            }
        });

        return zoneData;
    }
}
