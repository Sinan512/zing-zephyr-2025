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
  
  // Check if session is valid (not expired)
  isSessionValid: (req) => {
    if (!req.session || !req.session.adminLoggedIn) {
      return false;
    }
    
    // Check if session is still within 15 minutes
    const now = Date.now();
    if (req.session.lastActivity && (now - req.session.lastActivity) > 15 * 60 * 1000) {
      return false;
    }
    
    // Update last activity
    req.session.lastActivity = now;
    return true;
  }
};

