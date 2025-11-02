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
    }
}
