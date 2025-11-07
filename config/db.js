const { MongoClient } = require("mongodb");
require('dotenv').config(); // Add this line

// Use environment variable or fallback to local MongoDB
const uri ="mongodb://127.0.0.1:27017"|| process.env.MONGODB_URI
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully!");
    return client.db(process.env.DB_NAME || "Zing-Zephyr");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

module.exports = connectDB;