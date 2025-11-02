const collections = require("../config/collections");
const connectDB = require("../config/db");
const { response } = require("express");
const ObjectId = require("mongodb").ObjectId;

module.exports = {
  addToCallList: async (program, team, participants) => {
  const db = await connectDB();
  const existingProgram = await db
    .collection(collections.CALL_LISTS)
    .findOne({ program });

  // If program already exists
  if (existingProgram) {
    for (const participant of participants) {
      // Check if participant already exists for this team
      const alreadyExists = existingProgram.participants.some(
        (p) => p.participant === participant && p.team === team
      );

      if (alreadyExists) {
        console.log(`Participant ${participant} already exists in ${program}`);
        continue;
      }

      await db
        .collection(collections.CALL_LISTS)
        .updateOne(
          { program },
          { $push: { participants: { participant, team } } }
        );
    }
  } else {
    // If program does not exist → create a new one with all participants
    const newParticipants = participants.map((p) => ({ participant: p, team }));
    await db.collection(collections.CALL_LISTS).insertOne({
      program,
      participants: newParticipants,
    });
  }
},

  viewCallList:async()=>{
    var db=await connectDB();
    return await db.collection(collections.CALL_LISTS).find().toArray();
  },
  addCodeLetter: async (program, codes) => {
  const db = await connectDB();
  const existingProgram = await db
    .collection(collections.CALL_LISTS)
    .findOne({ program });

  if (!existingProgram) {
    return { success: false, message: "Program not found in database." };
  }

  // 🔹 Extract existing codes in DB to prevent duplicates
  const existingCodes = new Set(
    (existingProgram.participants || [])
      .map(p => p.code && p.code.toUpperCase())
      .filter(Boolean)
  );

  // 🔹 Check for duplicate codes inside submitted data itself
  const upperCodes = codes.map(c => c.code.toUpperCase());
  const uniqueCodes = new Set(upperCodes);
  if (uniqueCodes.size < upperCodes.length) {
    return { success: false, message: "Duplicate code letters found in input." };
  }

  // 🔹 Check if any code already exists in DB
  for (const c of codes) {
    if (existingCodes.has(c.code.toUpperCase())) {
      return {
        success: false,
        message: `Code letter '${c.code}' already exists in this program.`,
      };
    }
  }
  // 🔹 Update each participant's code
  for (const c of codes) {
    await db.collection(collections.CALL_LISTS).updateOne(
      { program, "participants.participant": c.member },
      { $set: { "participants.$.codes": c.code.toUpperCase() } }
    );
  }
  return { success: true, message: "Code letters successfully saved." };
},
getCodeLetter:async(programData)=>{
  const db = await connectDB();
  let codeletters=await db.collection(collections.CALL_LISTS).findOne(
  { program: programData },
  { projection: { "participants.codes": 1, _id: 0 } } // 👈 only return code letters
);
return codeletters?.participants || [];
}

};
