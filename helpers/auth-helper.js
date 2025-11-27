const collections = require("../config/collections");
const connectDB = require("../config/db");
const crypto = require("crypto");

module.exports = {
  // Simple hash function using crypto
  hashPassword: (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
  },
  
  // Initialize admin credentials if not exist
  initializeAdmin: async () => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const existing = await festNameCollection.findOne();
    
    if (!existing || !existing.adminUsername) {
      const hashedPassword = module.exports.hashPassword("annaba@123");
      await festNameCollection.updateOne(
        {},
        {
          $set: {
            adminUsername: "admin123",
            adminPassword: hashedPassword
          }
        },
        { upsert: true }
      );
      console.log("✅ Admin credentials initialized");
    }
  },
  // Initialize separate Add-Point credentials if not exist
  initializeAddPoint: async () => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const existing = await festNameCollection.findOne();
    if (!existing || !existing.addPointUsername) {
      const hashedPassword = module.exports.hashPassword("point@123");
      await festNameCollection.updateOne(
        {},
        {
          $set: {
            addPointUsername: "pointer",
            addPointPassword: hashedPassword
          }
        },
        { upsert: true }
      );
      console.log("✅ Add-Point credentials initialized");
    }
  },
  // Initialize separate Add-code letter credentials if not exist
  initializeAddCodeLetter: async () => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const existing = await festNameCollection.findOne();
    if (!existing || !existing.addCodeLetterUsername) {
      const hashedPassword = module.exports.hashPassword("point@123");
      await festNameCollection.updateOne(
        {},
        {
          $set: {
            addCodeLetterUsername: "coder",
            addCodeLetterPassword: hashedPassword
          }
        },
        { upsert: true }
      );
      console.log("✅ Add-code letter credentials initialized");
    }
  },
  
  // Verify admin credentials
  verifyAdmin: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const admin = await festNameCollection.findOne({ adminUsername: username });
    
    if (!admin || !admin.adminPassword) {
      return false;
    }
    
    const hashedInput = module.exports.hashPassword(password);
    return hashedInput === admin.adminPassword;
  },
  // Verify add-point credentials
  verifyAddPoint: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const creds = await festNameCollection.findOne({ addPointUsername: username });
    if (!creds || !creds.addPointPassword) return false;
    const hashedInput = module.exports.hashPassword(password);
    return hashedInput === creds.addPointPassword;
  },
  // Verify add-code letter credentials
  verifyAddCodeLetter: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const creds = await festNameCollection.findOne({ addCodeLetterUsername: username });
    if (!creds || !creds.addCodeLetterPassword) return false;
    const hashedInput = module.exports.hashPassword(password);
    return hashedInput === creds.addCodeLetterPassword;
  },
  
  // Update admin credentials
  updateAdmin: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const hashedPassword = module.exports.hashPassword(password);
    
    await festNameCollection.updateOne(
      {},
      {
        $set: {
          adminUsername: username,
          adminPassword: hashedPassword
        }
      },
      { upsert: true }
    );
    
    return true;
  },
  // Optionally allow updating add-point credentials (not wired to UI here)
  updateAddPoint: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const hashedPassword = module.exports.hashPassword(password);
    await festNameCollection.updateOne(
      {},
      { $set: { addPointUsername: username, addPointPassword: hashedPassword } },
      { upsert: true }
    );
    return true;
  },
   // Optionally allow updating add-code letter credentials (not wired to UI here)
  updateAddCodeLetter: async (username, password) => {
    const db = await connectDB();
    const festNameCollection = db.collection(collections.FEST_NAME);
    const hashedPassword = module.exports.hashPassword(password);
    await festNameCollection.updateOne(
      {},
      { $set: { addCodeLetterUsername: username, addCodeLetterPassword: hashedPassword } },
      { upsert: true }
    );
    return true;
  },
  
  // Check if session is valid (not expired)
  isSessionValid: (req) => {
    if (!req.session || !req.session.adminLoggedIn) {
      return false;
    }
    
    // Check if session is still within 15 minutes
    const now = Date.now();
    if (req.session.lastActivity && (now - req.session.lastActivity) > 24 * 60 * 60 * 1000) {
      return false;
    }
    
    // Update last activity
    req.session.lastActivity = now;
    return true;
  }
  ,
  // Check separate add-point session
  isAddPointSessionValid: (req) => {
    if (!req.session || !req.session.addPointLoggedIn) return false;
    const now = Date.now();
    if (req.session.addPointLastActivity && (now - req.session.addPointLastActivity) > 5 * 60 * 60 * 1000) {
      return false;
    }
    req.session.addPointLastActivity = now;
    return true;
  },
  // Check separate add-code letter session
  isAddCodeLetterSessionValid: (req) => {
    if (!req.session || !req.session.addCodeLetterLoggedIn) return false;
    const now = Date.now();
    if (req.session.addCodeLetterLastActivity && (now - req.session.addCodeLetterLastActivity) > 5 * 60 * 60 * 1000) {
      return false;
    }
    req.session.addCodeLetterLastActivity = now;
    return true;
  },
  resetData:async()=>{
    let db=await connectDB();
    await db.collection(collections.CALL_LISTS).drop();
    await db.collection(collections.RESULTS).drop();
    await db.collection(collections.TEAM_POINTS).drop();
    await db.collection(collections.PENDING_RESULTS).drop();
    await db.collection(collections.PUBLISHED).drop();
    await db.collection(collections.PUBLISHED_TEAM).drop();
    await db.collection(collections.INDIVIDUAL_POINTS).drop();
    await db.collection(collections.PUBLISHED_ZONE_TOPPERS).drop();
  }
};

